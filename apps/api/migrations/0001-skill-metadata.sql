-- v2: skill.json metadata fields
ALTER TABLE skills ADD COLUMN author TEXT;
ALTER TABLE skills ADD COLUMN license TEXT;
ALTER TABLE skills ADD COLUMN repository TEXT;
ALTER TABLE skills ADD COLUMN agents TEXT DEFAULT '[]';
ALTER TABLE skills ADD COLUMN search_tags TEXT DEFAULT '[]';
