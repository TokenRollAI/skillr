import chalk from 'chalk';
import Table from 'cli-table3';

export interface OutputAdapter {
  info(message: string): void;
  success(message: string): void;
  error(message: string): void;
  warn(message: string): void;
  table(headers: string[], rows: string[][]): void;
  json(data: unknown): void;
}

export class TtyOutput implements OutputAdapter {
  info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  success(message: string): void {
    console.log(chalk.green('✔'), message);
  }

  error(message: string): void {
    console.error(chalk.red('✖'), message);
  }

  warn(message: string): void {
    console.warn(chalk.yellow('⚠'), message);
  }

  table(headers: string[], rows: string[][]): void {
    const table = new Table({ head: headers.map((h) => chalk.cyan(h)) });
    for (const row of rows) {
      table.push(row);
    }
    console.log(table.toString());
  }

  json(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  }
}

export class JsonOutput implements OutputAdapter {
  info(message: string): void {
    console.log(JSON.stringify({ type: 'info', message }));
  }

  success(message: string): void {
    console.log(JSON.stringify({ type: 'success', message }));
  }

  error(message: string): void {
    console.log(JSON.stringify({ type: 'error', message }));
  }

  warn(message: string): void {
    console.log(JSON.stringify({ type: 'warn', message }));
  }

  table(headers: string[], rows: string[][]): void {
    const data = rows.map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] ?? '';
      });
      return obj;
    });
    console.log(JSON.stringify({ type: 'table', data }));
  }

  json(data: unknown): void {
    console.log(JSON.stringify(data));
  }
}

export function createOutput(options?: { json?: boolean }): OutputAdapter {
  if (options?.json || !process.stdout.isTTY) {
    return new JsonOutput();
  }
  return new TtyOutput();
}
