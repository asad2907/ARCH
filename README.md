# Tabeen Atelier

Static portfolio website for Tabeen Atelier, structured for direct deployment to GitHub Pages.

## Project structure

```text
.
|-- index.html
|-- about.html
|-- services.html
|-- projects.html
|-- journal.html
|-- contact.html
|-- assets/
|   |-- images/
|   |   `-- noise-texture.svg
|   |-- logos/
|   |-- icons/
|   |   `-- chevron-down.svg
|   |-- fonts/
|   |-- documents/
|   `-- videos/
|-- css/
|   `-- style.css
|-- js/
|   `-- script.js
|-- CNAME
|-- robots.txt
|-- sitemap.xml
`-- README.md
```

Empty asset directories contain `.gitkeep` files so the intended structure is retained in Git.

## Local preview

Serve the repository root with any static web server. For example:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000`.
