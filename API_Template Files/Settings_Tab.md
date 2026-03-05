Header:

<style>
  #header, #footer { padding: 0 !important; }
  .clarence-header {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; padding: 8px 24px 7px; border-bottom: 1.5px solid #e2e8f0;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
  }
  .clarence-header-left { display: flex; align-items: center; gap: 8px; }
  .clarence-header-wordmark { display: flex; flex-direction: column; line-height: 1; }
  .clarence-header-brand { font-size: 11px; font-weight: 700; color: #1e293b; letter-spacing: 1.5px; font-family: Georgia, 'Times New Roman', serif; }
  .clarence-header-tagline { font-size: 6.5px; color: #94a3b8; font-style: italic; letter-spacing: 0.3px; margin-top: 1px; }
  .clarence-header-right { text-align: right; line-height: 1.4; }
  .clarence-header-doctype { font-size: 7px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  .clarence-header-meta { font-size: 6.5px; color: #94a3b8; }
</style>

<div class="clarence-header">
  <div class="clarence-header-left">
    <svg width="24" height="24" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="14" fill="#1e293b"/>
      <path d="M38.5 18.5C35.2 16.3 31.5 15.5 28 15.8C20 16.5 14 23.2 14 31.2C14 39.8 20.8 46.8 29 47.2C32.5 47.4 35.8 46.3 38.5 44.3" stroke="#10b981" stroke-width="5" stroke-linecap="round" fill="none"/>
      <circle cx="43" cy="18" r="3.5" fill="#f59e0b"/>
    </svg>
    <div class="clarence-header-wordmark">
      <div class="clarence-header-brand">CLARENCE</div>
      <div class="clarence-header-tagline">The Honest Broker</div>
    </div>
  </div>
  <div class="clarence-header-right">
    <div class="clarence-header-doctype">{{ documentType }}</div>
    <div class="clarence-header-meta">{{ contractName }} &bull; {{ generatedDate }}</div>
  </div>
</div>


Footer:

<!-- ================================================================== -->
<!-- CLARENCE DOCUMENT FOOTER — APITemplate.io Settings Tab             -->
<!-- Paste into: Settings > Custom Footer                               -->
<!--                                                                    -->
<!-- Jinja2 Variables Required:                                         -->
<!--   {{ footer.confidentiality }}  — e.g. "CONFIDENTIAL — ..."       -->
<!--                                                                    -->
<!-- Dynamic Classes (injected by APITemplate engine):                   -->
<!--   .pageNumber   — current page number                              -->
<!--   .totalPages   — total number of pages                            -->
<!--                                                                    -->
<!-- These variables must be passed in the JSON payload from N8N.       -->
<!-- ================================================================== -->

<style>
  #header, #footer { padding: 0 !important; }

  .clarence-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 6px 24px 8px;
    border-top: 1px solid #e2e8f0;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
    font-size: 6.5px;
    color: #94a3b8;
  }

  .clarence-footer-left {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .clarence-footer-company {
    font-weight: 700;
    color: #64748b;
  }

  .clarence-footer-sep {
    color: #cbd5e1;
    margin: 0 3px;
  }

  .clarence-footer-conf {
    color: #94a3b8;
  }

  .clarence-footer-right {
    font-weight: 600;
    color: #64748b;
  }
</style>

<div class="clarence-footer">
  <div class="clarence-footer-left">
    <!-- Mini Logo Mark -->
    <svg width="12" height="12" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="14" fill="#1e293b"/>
      <path d="M38.5 18.5C35.2 16.3 31.5 15.5 28 15.8C20 16.5 14 23.2 14 31.2C14 39.8 20.8 46.8 29 47.2C32.5 47.4 35.8 46.3 38.5 44.3" stroke="#10b981" stroke-width="5" stroke-linecap="round" fill="none"/>
      <circle cx="43" cy="18" r="3" fill="#f59e0b"/>
    </svg>
    <span class="clarence-footer-company">Clarence Legal Limited</span>
    <span class="clarence-footer-sep">|</span>
    <span class="clarence-footer-conf">{{ footer.confidentiality }}</span>
  </div>
  <div class="clarence-footer-right">
    Page <span class="pageNumber"></span> of <span class="totalPages"></span>
  </div>
</div>