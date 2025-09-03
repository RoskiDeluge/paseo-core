workspace "Paseo Core — Embedding Store Actor" "C4 container model with two-stage retrieval" {

  !identifiers hierarchical

  model {
    // People & primary client
    u = person "Developer" "Builds agentic apps; configures/reviews actor"
    ssClient = softwareSystem "Agent / Client App" "Queries embeddings via SDK/HTTP"

    // Primary system
    ss = softwareSystem "Paseo Core" "Cloudflare Worker + Durable Object runtime exposing actor APIs" {
      wa = container "Worker Router" "Routes /actors/:name/*" "Cloudflare Worker"
      emb = container "Embedding Store Actor (DO)" "Episodic, semantic, tool registry; matryoshka two-stage retrieval" "Cloudflare Durable Object"
      db = container "DO Storage" "Key-value persistence for items and vectors" "Cloudflare DO Storage" {
        tags "Database"
      }
      vec = container "Vector Backend (optional)" "ANN index (Vectorize/pgvector/OpenSearch)" "Service/DB"
      prov = container "Embedding Provider (optional)" "Embeddings-as-a-service" "HTTP API"
    }

    // External platforms (kept simple; no extra tokens)
    cfAI   = softwareSystem "Cloudflare Workers AI"
    openAI = softwareSystem "OpenAI Embeddings API"
    pg     = softwareSystem "Postgres/pgvector"
    os     = softwareSystem "OpenSearch"

    // Relationships (use hierarchical identifiers per tutorial)
    u -> ssClient "Builds & configures"
    ssClient -> ss.wa "SDK/HTTP calls /actors/*"
    ss.wa -> ss.emb "Dispatch"
    ss.emb -> ss.db "Read/write items & vectors"
    ss.emb -> ss.vec "Coarse/full ANN search (optional)" "ANN"
    ss.emb -> ss.prov "Auto-embed text (optional)" "HTTP"
    ss.prov -> cfAI "Embed text" "HTTP"
    ss.prov -> openAI "Embed text" "HTTP"
    ss.vec -> pg "Store/search vectors"
    ss.vec -> os "Store/search vectors"
  }

  views {
    // System context (scope: ss)
    systemContext ss "paseo-context" {
      include *
      autolayout lr
    }

    // Container view (scope: ss)
    container ss "paseo-containers" {
      include *
      autolayout lr
    }

    // Two-stage retrieval (coarse → rerank)
    dynamic ss "two-stage-retrieval" {
      ssClient -> ss.wa "Search (q or vector)"
      ss.wa -> ss.emb "Dispatch"
      ss.emb -> ss.vec "Stage 1: coarse top-K on truncated dims"
      ss.emb -> ss.db "Fetch candidates & full vectors"
      ss.emb -> ss.vec "Stage 2: rerank with full vector"
      ss.emb -> ss.wa "Return results"
      ss.wa -> ssClient "Results"
      autolayout lr
    }

    // Styles (exactly as in the tutorial’s syntax)
    styles {
      element "Element" {
        color #0773af
        stroke #0773af
        strokeWidth 7
        shape roundedbox
      }
      element "Person" {
        shape person
      }
      element "Database" {
        shape cylinder
      }
      relationship "Relationship" {
        thickness 4
      }
    }
  }
}

