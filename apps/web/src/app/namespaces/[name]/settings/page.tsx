import NamespaceSettingsPage from './namespace-settings';

export async function generateStaticParams() {
  return [{ name: '_' }];
}

export default function Page() {
  return <NamespaceSettingsPage />;
}
