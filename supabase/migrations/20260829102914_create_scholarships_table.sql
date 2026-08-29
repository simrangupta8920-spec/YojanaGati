/*
# Create scholarships table (single-tenant, no auth)

1. New Tables
- `scholarships`: Static repository of scholarship listings
  - `id` (uuid, primary key)
  - `name` (text, not null) — scholarship name
  - `name_hindi` (text) — Hindi name for localization
  - `description` (text, not null) — detailed description
  - `category` (text, not null) — e.g. "Merit", "Need-based", "Minority", "Disability", "Sports"
  - `eligibility_criteria` (text, not null) — who can apply
  - `required_documents` (text[], not null) — list of documents needed
  - `funding_amount` (text, not null) — award amount (stored as text for flexibility)
  - `deadline` (text, not null) — application deadline
  - `min_income` (text) — maximum family income for eligibility
  - `min_percentage` (integer) — minimum marks percentage required
  - `education_level` (text, not null) — e.g. "School", "Undergraduate", "Postgraduate", "Any"
  - `provider` (text, not null) — government body or organization
  - `region` (text, not null) — applicable region/state
  - `keywords` (text[], not null) — search keywords for RAG retrieval
  - `created_at` (timestamp)

2. Security
- Enable RLS on `scholarships`.
- Allow anon + authenticated read access (public scholarship directory).
- No writes from frontend (data managed via migrations).
*/

CREATE TABLE IF NOT EXISTS scholarships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_hindi text,
  description text NOT NULL,
  category text NOT NULL,
  eligibility_criteria text NOT NULL,
  required_documents text[] NOT NULL DEFAULT '{}',
  funding_amount text NOT NULL,
  deadline text NOT NULL,
  min_income text,
  min_percentage integer,
  education_level text NOT NULL DEFAULT 'Any',
  provider text NOT NULL,
  region text NOT NULL DEFAULT 'All India',
  keywords text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scholarships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_scholarships" ON scholarships;
CREATE POLICY "anon_read_scholarships" ON scholarships FOR SELECT
  TO anon, authenticated USING (true);
