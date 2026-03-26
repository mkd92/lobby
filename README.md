## React + TypeScript + Vite

... (rest of the file) ...

```

## Local Supabase Setup

This project uses Supabase for the backend. To set it up locally:

1.  **Initialize Supabase:**
    ```bash
    supabase init
    ```
2.  **Start Supabase services:**
    ```bash
    supabase start
    ```
    *(Note: This requires Docker to be running)*
3.  **Local Credentials:**
    The `.env` file contains the local URL and anon key.
    - **Studio:** http://127.0.0.1:54323
    - **API URL:** http://127.0.0.1:54321
