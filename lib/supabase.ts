import { createClient } from "@supabase/supabase-js";

// Anon key é segura para expor no client — o acesso real é controlado pelas
// policies de Row Level Security no banco. Mantida como constante (em vez de
// variável de ambiente) para não exigir configuração extra no painel da Vercel.
const SUPABASE_URL = "https://imlffgsouyopbfsdqaft.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbGZmZ3NvdXlvcGJmc2RxYWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MzA2ODMsImV4cCI6MjA5NzAwNjY4M30.kdTj948GfS17CWoIyPTjNTgL5xWo6ZfHwqdAl1pGgsA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
