CREATE TABLE IF NOT EXISTS albums(
  id VARCHAR(255) PRIMARY KEY
);

ALTER TABLE albums
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS image VARCHAR(255),
ADD COLUMN IF NOT EXISTS url VARCHAR(255),
ADD COLUMN IF NOT EXISTS artists JSONB[],
ADD COLUMN IF NOT EXISTS genres text[],
ADD COLUMN IF NOT EXISTS track_list JSONB[],
ADD COLUMN IF NOT EXISTS rating_sum INTEGER,
ADD COLUMN IF NOT EXISTS rating_amount INTEGER
;

CREATE TABLE IF NOT EXISTS users(
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name VARCHAR(255) UNIQUE
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS salt BYTEA,
ADD COLUMN IF NOT EXISTS hashed_pass_word BYTEA,
ADD COLUMN IF NOT EXISTS user_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS viewer_mode VARCHAR(255) DEFAULT 'public',
ADD COLUMN IF NOT EXISTS profile_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS profile_image BYTEA,
ADD COLUMN IF NOT EXISTS spotify_token JSONB
;

CREATE TABLE IF NOT EXISTS pasipo(
  user_id UUID,
  date DATE,
  PRIMARY KEY (user_id, date)
);

ALTER TABLE pasipo
ADD COLUMN IF NOT EXISTS user_notes VARCHAR(255),
ADD COLUMN IF NOT EXISTS album_id VARCHAR(255)
;

CREATE TABLE IF NOT EXISTS ratings(
  user_id UUID,
  album_id VARCHAR(255),
  PRIMARY KEY (user_id, album_id)
);

ALTER TABLE ratings
ADD COLUMN IF NOT EXISTS rating INT[]
;