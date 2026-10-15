# picard-architecte.fr — nouveau site

Site statique (HTML/CSS/JS, aucune dépendance) généré à partir de `content/`.

```
content/site.json         identité, coordonnées, certifications, catégories
content/projects.json     les projets (textes, fiche technique, photo de couverture)
content/raw.json          inventaire de l'ancien site (images, vidéos) — généré
content/media-manifest.json  médias utilisés par le site — généré par le build
media/                    photos (JPEG + WebP) et vidéos rapatriées — 1,6 Go, hors Git
src/assets/               style.css, main.js
scripts/crawl.mjs         relit l'ancien site → content/raw.json
scripts/build.mjs         génère le site (dév., validation ou production)
scripts/fetch-media.mjs   copie les médias de l'ancien site dans media/
scripts/check.mjs         vérifie liens, images, title/description/h1
scripts/dims.mjs          mesure les images de media/ → content/dims.json (width/height)
scripts/serve.mjs         serveur local de prévisualisation
```

## Travailler en local

```bash
node scripts/build.mjs                         # dév. : photos chargées depuis l'ancien site
node scripts/serve.mjs dist 4321
```

Modifier un texte ou une photo de couverture : éditer `content/projects.json` (champ `hero` = morceau du nom
de fichier de l'image), puis relancer le build. Si une nouvelle image est utilisée, relancer
`node scripts/fetch-media.mjs` (il ne recopie que ce qui manque).

## Mise en ligne sur OVH (envoi direct)

Après l'envoi, `www/` contiendra :

```
www/media/        photos et vidéos du nouveau site (1,5 Go, envoyé une fois)
www/index.html, www/projets/, www/assets/, www/.htaccess …   le nouveau site
www/images/, www/video/, anciens *.html   ancien site Sitely, plus utilisé (redirigé)
```

FileZilla : se connecter en FTP/SFTP (identifiants dans l'espace client OVH → Hébergements → FTP-SSH).
Afficher les fichiers cachés (menu Serveur → Forcer l'affichage des fichiers cachés) pour envoyer `.htaccess`.

1. **Sauvegarder l'ancien site** : télécharger tout `www/` sur l'ordinateur.
2. Récupérer les médias (si `media/` n'est pas déjà là) puis générer la version de production :
   ```bash
   node scripts/fetch-media.mjs
   node scripts/build.mjs --prod
   node scripts/check.mjs dist
   ```
3. Envoyer le dossier `media/` dans `www/media/` (long : 1,5 Go). **Le faire en premier**, avant les pages.
4. Envoyer **le contenu** de `dist/` dans `www/` (accepter d'écraser `index.html`).
5. Tester https://picard-architecte.fr (Ctrl+F5) et une ancienne adresse, par exemple
   https://picard-architecte.fr/dardilly.html → doit rediriger vers la nouvelle fiche.
6. Google Search Console : ajouter le site et déclarer `https://picard-architecte.fr/sitemap.xml`.

Mise à jour plus tard (texte, photo de couverture) : modifier `content/`, relancer `build.mjs --prod`,
renvoyer `dist/` (pas besoin de renvoyer `media/`, sauf nouvelles images).

Option : une version de test non indexée sur `/new/` existe (`build.mjs --staging` → `dist-staging/` à envoyer dans `www/new/`).

Les anciennes pages `.html`, `images/` et `video/` de Sitely peuvent rester ou être supprimées plus tard :
le nouveau site ne les utilise plus, et le `.htaccess` redirige les anciennes adresses (301).

**Après la bascule, ne plus publier depuis Sitely** : une publication réécrirait `index.html`.

### Si le site ne s'affiche pas après l'envoi

- **Boucle de redirection** : dans `.htaccess`, remplacer `RewriteCond %{HTTPS} off [OR]`
  par `RewriteCond %{HTTP:X-Forwarded-Proto} !https [OR]`.
- **Erreur 500** : supprimer la ligne `Options -Indexes` du `.htaccess`.
- En dernier recours, renommer `.htaccess` en `htaccess.off` : le site fonctionne, sans les redirections.

## Sauvegarde des médias

`media/` n'est pas dans Git (1,5 Go, trop lourd pour GitHub). Il est recopiable depuis l'ancien site
(`fetch-media.mjs`) **tant que `www/images/` et `www/video/` existent**. Avant de les supprimer du serveur,
garder une copie de `media/` (disque externe, Drive…) : c'est la seule source des photos.

## Reste à compléter

À demander à Eric Picard (chaque réponse débloque une amélioration) :
1. **Confirmer** la commune de la résidence seniors (Craponne ou Lyon ?) et l'intitulé exact des distinctions
   → corriger `content/projects.json` et `content/site.json`.
2. **Fiches des 15–20 plus belles sculptures** (titre, matière, dimensions, année, disponible / vendue / sur commande)
   → légendes nommées, page Sculptures « catalogue », meilleur référencement des œuvres.
3. **N° d'inscription à l'Ordre des architectes et SIRET** → mentions légales complètes (obligatoire).
4. **Quelques phrases** sur Megève, Saint-Raphaël, Oullins, Septème, Mions → fiches moins courtes, mieux classées.
5. **Choisir les 4 plus belles photos** des projets mis en avant → champ `features` dans `content/projects.json`.


- Mentions légales : n° d'inscription à l'Ordre des architectes et SIRET (`scripts/build.mjs`, page mentions légales).
- Projets publics, collectifs, lotissements et maisons groupées : pour l'instant, lien vers l'ancien site 2020.
- Polices Google Fonts : à héberger localement (RGPD).
- À faire confirmer : commune de la résidence seniors (Craponne ou Lyon ?), intitulés des distinctions.
