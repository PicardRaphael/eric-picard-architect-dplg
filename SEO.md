# SEO gratuit — picard-architecte.fr

Le site est prêt côté technique. Ce qui reste, c'est **hors du site**, et entièrement gratuit.
Faire les étapes dans l'ordre : les premières rapportent le plus.

Règle d'or : partout, exactement le même nom, la même adresse, le même téléphone :

```
Eric Picard – Architecte D.P.L.G
9, rue d'Austerlitz, 69004 Lyon
06 63 05 53 41
https://picard-architecte.fr
```

---

## 1. Google Search Console (jour de la mise en ligne, 15 min)

1. https://search.google.com/search-console → **Ajouter une propriété** → **Préfixe d'URL** → `https://picard-architecte.fr/`
2. Validation : **Fichier HTML** → télécharger le fichier → l'envoyer dans `www/` avec FileZilla → **Valider**.
3. Menu **Sitemaps** → `sitemap.xml` → **Envoyer**.
4. Menu **Inspection de l'URL** → demander l'indexation de :
   - `https://picard-architecte.fr/`
   - `https://picard-architecte.fr/architecte-lyon/`
   - `https://picard-architecte.fr/sculptures/`
5. Revenir dans 2 semaines : rubrique **Pages** (ce qui est indexé) et **Performances** (les recherches qui amènent du monde).

**Bing** (5 min) : https://www.bing.com/webmasters → *Importer depuis Google Search Console*.

---

## 2. Fiche Google Business Profile (le levier n° 1, 30 min)

C'est elle qui s'affiche sur Google Maps et à droite des résultats quand on cherche « architecte Lyon 4 ».

https://business.google.com → *Ajouter votre établissement*

- **Nom** : `Eric Picard – Architecte D.P.L.G`
- **Catégorie principale** : `Architecte`
- **Catégories secondaires** (si proposées) : `Architecte d'intérieur`, `Sculpteur`
- **Adresse** : 9, rue d'Austerlitz, 69004 Lyon (ou « zone desservie » si on ne reçoit pas à l'atelier)
- **Zone desservie** : Lyon, Rhône, Ain, Isère, Haute-Savoie
- **Téléphone** : 06 63 05 53 41 — **Site** : https://picard-architecte.fr
- **Horaires** : ceux de ton père (ou « sur rendez-vous »)
- Validation par Google : courrier, téléphone ou vidéo — suivre les indications.

**Description** (à coller, 700 caractères) :

```
Architecte D.P.L.G installé à Lyon 4e, rue d'Austerlitz, Eric Picard accompagne particuliers, commerçants et maîtres d'ouvrage : extension de maison, maison contemporaine, rénovation et restructuration d'appartements, réhabilitation de maisons bourgeoises et de corps de ferme, aménagement de boutiques et de cabinets. De l'étude de faisabilité au permis de construire, puis au suivi de chantier. Certifié ADEME HQE (mention Très Bien), lauréat de la Société Académique d'Architecture de Lyon. Également sculpteur : œuvres et sculptures sur commande. Projets à Lyon, dans le Rhône, l'Ain, la Haute-Savoie, le Var.
```

**Services** (à ajouter un par un) :
Extension de maison · Maison contemporaine · Rénovation d'appartement · Réhabilitation de maison · Permis de construire · Déclaration préalable · Étude de faisabilité · Suivi de chantier · Aménagement de commerce · Mise aux normes PMR · Sculpture sur commande

**Photos** (au moins 10, depuis le dossier `media/`) : Annecy, Duchère (cuisine), Lyon 4 (escalier), Lyon 6, Dardilly, Craponne, Dolce, Saint-Raphaël, 2–3 sculptures. Ajouter ensuite **une photo par mois** : Google aime les fiches vivantes.

**Bonus** : https://business.apple.com (Apple Plans) et https://www.bingplaces.com (import depuis Google) — mêmes informations, 10 min chacun.

---

## 3. Avis Google (le plus convaincant pour un prospect)

Dans la fiche Google Business Profile → **Demander des avis** → copier le lien.
Envoyer à 5–10 anciens clients satisfaits (cabinet de podologie, particuliers, Dolce, Emilia G…) :

```
Bonjour [prénom],
J'espère que vous profitez toujours de [votre extension / votre appartement / votre boutique].
Je viens de mettre en ligne mon nouveau site, et un avis de votre part sur Google
m'aiderait beaucoup à faire connaître l'atelier. Cela prend une minute :
[lien]
Merci infiniment,
Eric Picard
```

Répondre à chaque avis, même par une phrase : Google le valorise.

---

## 4. Annuaires gratuits (1 h au total)

Mêmes nom, adresse, téléphone, site partout.

| Site | Pourquoi | Où |
|---|---|---|
| **Ordre des architectes** | Annuaire officiel, très fiable pour Google | https://www.architectes.org → annuaire : vérifier la fiche, ajouter le site |
| **Houzz** | Là où les particuliers cherchent un architecte pour leur maison | https://www.houzz.fr → profil professionnel gratuit + 3–4 projets |
| **PagesJaunes** | Fiche gratuite, bien référencée | https://www.solocal.com → fiche gratuite (refuser les options payantes) |
| **Instagram** @picardarchitecte | Mettre `https://picard-architecte.fr` dans la bio | Application Instagram |
| **Facebook** (facultatif) | Page professionnelle gratuite avec le lien | facebook.com |

---

## 5. Liens vers le site (gratuits, très efficaces)

Demander un lien vers `https://picard-architecte.fr` à :
- la **Société Académique d'Architecture de Lyon** (page des lauréats) ;
- le journal qui a publié l'**article sur l'Espace de la fête** (version en ligne) ;
- la production de l'émission de **Stéphane Plaza** (« Une pièce à vivre », 24 avril 2018), si une page existe ;
- les **clients professionnels** : Dolce, Emilia G, le cabinet de podologie, Confiance Immobilier (page « nos partenaires » ou réseaux) ;
- les **artisans** avec qui il travaille (ébéniste, staffeur, serrurier…) — échange de liens.

---

## 6. Vendre ses sculptures (gratuit)

Sur le site, c'est prêt : la page **Sculptures** vise « sculpteur Lyon », et la page
**Sculpture sur commande** (`/sculpture-sur-commande/`) explique comment commander, avec un bouton devis.
Les 148 œuvres sont déclarées à Google Images via le sitemap.

Pour que des acheteurs la trouvent :

1. **Fiche Google Business Profile** : ajouter la catégorie secondaire `Sculpteur` et le service
   `Sculpture sur commande` (voir §2). Publier 1 photo d'œuvre par mois.
2. **Instagram** @picardarchitecte : 1 à 2 publications par semaine — une œuvre, un détail, l'atelier en train de travailler.
   Mettre le lien `https://picard-architecte.fr/sculpture-sur-commande/` dans la bio.
   Mots-clés en fin de texte : `#sculpture #sculpteur #sculpteurlyon #artlyon #sculpturecontemporaine #lyon #artiste`
3. **Pinterest** (compte gratuit) : épingler les photos des œuvres et des réalisations avec le lien vers le site —
   très utilisé pour chercher des idées de décoration et d'objets d'art, et bien référencé dans Google Images.
4. **Leboncoin**, rubrique Décoration / Art : annonces gratuites pour quelques pièces disponibles,
   avec le lien du site dans le texte — clientèle locale, Lyon et région.
5. **Artmajeur** (formule gratuite) : galerie en ligne d'artistes, pour être visible auprès des amateurs d'art.
6. **En vrai, à Lyon** : l'atelier est dans le 4e, à la Croix-Rousse, quartier d'artistes — se renseigner sur
   les marchés de la création, salons d'art et portes ouvertes d'ateliers d'artistes, et laisser des cartes avec l'adresse du site.

Le plus important pour vendre : **les fiches des œuvres** (titre, matière, dimensions, disponible ou non).
Avec elles, chaque sculpture peut avoir sa légende sur le site, et on peut afficher « disponible » sur les pièces à vendre.

---

## 7. Ce qui fera encore monter le site (contenu, gratuit)

Chaque information de ton père = une page plus forte :
1. **Quelques phrases** pour Megève, Saint-Raphaël, Oullins, Septème, Mions → modifier `content/projects.json`.
2. **Les fiches des 15–20 plus belles sculptures** (titre, matière, dimensions, année, disponibilité).
3. **Un nouveau projet** dès qu'un chantier se termine (Lyon 8, Simandres) : photos + texte → nouvelle page.
4. **N° d'Ordre et SIRET** dans les mentions légales (obligatoire, et rassurant pour Google comme pour les clients).

---

## Calendrier

| Quand | Quoi |
|---|---|
| Jour J | Search Console + sitemap, Bing |
| Semaine 1 | Google Business Profile (+ Apple, Bing Places), Instagram, demande d'avis |
| Semaine 2 | Ordre des architectes, Houzz, PagesJaunes |
| Mois 1 | Liens (Société Académique, presse, clients), premiers résultats dans Search Console |
| Chaque mois | 1 photo sur la fiche Google, répondre aux avis, ajouter les nouveaux projets |
