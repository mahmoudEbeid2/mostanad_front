# Frontend backlog

Things noticed during the UI plan work (28 Nov) that are outside its phases. Not done.

- **Assistant company scope.** The chat keeps its own "All companies" choice; it doesn't follow the header's company switcher yet.
- **Check a label** lists "Global Verification" as a company in its own picker; it should follow the header switcher too.
- **Products → company filter for system users**: the page now follows the header switcher; there is no "All companies" view any more. If an all-companies product view is wanted, add it as an explicit toggle.
- **FSC / HC template scope default** (plan §1, walkthrough #7): templates default to "Per product"; FSC and HC should default to "Per request / shipment" — backend default + the Templates page.
- **Re-drop of the same files** makes a new full set of drafts (walkthrough #2); offer "update the existing request" instead — needs backend.
- **One upload component**: the limits and the message are shared now (`src/utils/uploadLimits.js`), but Intake, Invoices, Catalogues, label resize and the chat still each have their own drop zone UI.
- **Source chips in the certificate editor** take a lot of room; collapse them (plan Phase G §3).
- **Finalize button** should say what blocks it, with links (plan Phase G §3).
- **Main bundle is > 500 kB**; split routes with dynamic `import()`.
