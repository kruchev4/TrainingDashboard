# MHE Certification Dashboard

Static site. No build step, no outside dependencies.

Files (keep all four in the SAME folder as index.html):
  index.html, app.js, styles.css, .nojekyll

Deploy on GitHub Pages:
1. Repo > Add file > Upload files. Drag the CONTENTS of this folder (not the folder itself) so index.html is at the repo root.
2. Settings > Pages > Source: Deploy from a branch > Branch: main, folder: / (root) > Save.
3. Wait 1-2 minutes. Site is at https://<user>.github.io/<repo>/

Note: data is saved per browser (localStorage). Each person/browser sees its own data.
