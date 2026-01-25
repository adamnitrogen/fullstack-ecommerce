-- ========================================================
-- STRICT i18n DATABASE MIGRATION
-- Converts text columns to JSONB objects: { "en": "...", "hi": "..." }
-- ========================================================

BEGIN;

-- 0. CORE (User Preferences)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'en' CHECK (preferred_language IN ('en', 'hi'));

-- 1. PRODUCTS TABLE
ALTER TABLE products ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS benefits_i18n JSONB DEFAULT '{}';

UPDATE products 
SET 
  title_i18n = jsonb_build_object('en', title, 'hi', title),
  description_i18n = jsonb_build_object('en', description, 'hi', description),
  benefits_i18n = jsonb_build_object('en', benefits, 'hi', benefits);

-- 2. BLOGS TABLE
ALTER TABLE public.blogs ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}';
ALTER TABLE public.blogs ADD COLUMN IF NOT EXISTS excerpt_i18n JSONB DEFAULT '{}';
ALTER TABLE public.blogs ADD COLUMN IF NOT EXISTS content_i18n JSONB DEFAULT '{}';

UPDATE public.blogs 
SET 
  title_i18n = jsonb_build_object('en', title, 'hi', title),
  excerpt_i18n = jsonb_build_object('en', excerpt, 'hi', excerpt),
  content_i18n = jsonb_build_object('en', content, 'hi', content);

-- 3. EVENTS TABLE
ALTER TABLE events ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS key_highlights_i18n JSONB DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS special_privileges_i18n JSONB DEFAULT '{}';

UPDATE events 
SET 
  title_i18n = jsonb_build_object('en', title, 'hi', title),
  description_i18n = jsonb_build_object('en', description, 'hi', description),
  key_highlights_i18n = jsonb_build_object('en', key_highlights, 'hi', key_highlights),
  special_privileges_i18n = jsonb_build_object('en', special_privileges, 'hi', special_privileges);

-- 4. FAQs TABLE
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS question_i18n JSONB DEFAULT '{}';
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS answer_i18n JSONB DEFAULT '{}';

UPDATE faqs 
SET 
  question_i18n = jsonb_build_object('en', question, 'hi', question),
  answer_i18n = jsonb_build_object('en', answer, 'hi', answer);

-- 5. ABOUT TABLES
-- Missions & Vision
ALTER TABLE about_cards ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}';
ALTER TABLE about_cards ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}';
UPDATE about_cards SET title_i18n = jsonb_build_object('en', title, 'hi', title), description_i18n = jsonb_build_object('en', description, 'hi', description);

-- Impact Stats (Value is often numeric or short string, Label needs translation)
ALTER TABLE about_impact_stats ADD COLUMN IF NOT EXISTS label_i18n JSONB DEFAULT '{}';
UPDATE about_impact_stats SET label_i18n = jsonb_build_object('en', label, 'hi', label);

-- Timeline
ALTER TABLE about_timeline ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}';
ALTER TABLE about_timeline ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}';
UPDATE about_timeline SET title_i18n = jsonb_build_object('en', title, 'hi', title), description_i18n = jsonb_build_object('en', description, 'hi', description);

-- Team
ALTER TABLE about_team_members ADD COLUMN IF NOT EXISTS role_i18n JSONB DEFAULT '{}';
ALTER TABLE about_team_members ADD COLUMN IF NOT EXISTS bio_i18n JSONB DEFAULT '{}';
UPDATE about_team_members SET role_i18n = jsonb_build_object('en', role, 'hi', role), bio_i18n = jsonb_build_object('en', bio, 'hi', bio);

-- Goals
ALTER TABLE about_future_goals ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}';
ALTER TABLE about_future_goals ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}';
UPDATE about_future_goals SET title_i18n = jsonb_build_object('en', title, 'hi', title), description_i18n = jsonb_build_object('en', description, 'hi', description);

-- Settings
ALTER TABLE about_settings ADD COLUMN IF NOT EXISTS footer_description_i18n JSONB DEFAULT '{}';
UPDATE about_settings SET footer_description_i18n = jsonb_build_object('en', footer_description, 'hi', footer_description);

-- 6. POLICIES TABLE
ALTER TABLE policy_pages ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}';
ALTER TABLE policy_pages ADD COLUMN IF NOT EXISTS content_html_i18n JSONB DEFAULT '{}';

UPDATE policy_pages 
SET 
  title_i18n = jsonb_build_object('en', title, 'hi', title),
  content_html_i18n = jsonb_build_object('en', content_html, 'hi', content_html);

-- 7. CLEANUP (Optional: Decide whether to drop old columns or keep for safety during transition)
-- For this step, we keep columns to avoid breaking code while we update services.

COMMIT;
