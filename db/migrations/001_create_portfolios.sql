-- One independent portfolio per Kinde identity. Financial records will live in
-- separate, versioned tables; FYERS quotes are not holdings or transactions.
CREATE TABLE portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kinde_subject text NOT NULL UNIQUE CHECK (length(trim(kinde_subject)) BETWEEN 1 AND 255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
