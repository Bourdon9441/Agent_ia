# Système de design — Agent_ia

Généré selon la méthode [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill). Toute nouvelle interface, brique ou écran d'Agent_ia doit suivre ce système (complété du vocabulaire [impeccable](https://github.com/pbakaus/impeccable) et des icônes [Papicons](https://github.com/PapillonApp/Papicons)).

## TARGET : Agent_ia — centre de pilotage d'agents IA

- Produit : tableau de bord d'entreprise d'agents IA (dashboard + éditeur de plan nodal style n8n)
- Utilisateur : dirigeant non technique, français, sur PC (Edge/Chrome), doit tout piloter sans jargon

## PATTERN : Dashboard opérationnel + éditeur nodal

- Conversion : mise en action immédiate (embaucher, confier, activer l'autonomie)
- Structure : barre supérieure (identité, compte, thème) → vue Plan (n8n) ou Liste → PC virtuel (onglets) → journal d'activité en direct
- Le plan nodal est la vue par défaut : hiérarchie VOUS → Patron → sous-patrons → agents, services à droite

## STYLE : AI-Native UI (dark technique)

- Mots-clés : fond quasi noir, accent signal unique, mono pour les données, chiffres et statuts, densité maîtrisée, liserés fins
- Interdits de style : dégradés violets/rose « IA générique », emojis comme icônes, effets néon multiples, sur-animation

## COLORS (tokens CSS — ne jamais coder une couleur en dur)

| Rôle | Token | Valeur (thème par défaut « Vert lime ») |
|---|---|---|
| Fond | `--bg` | quasi noir |
| Surface / carte | `--surface`, `--raise` | gris très sombres |
| Liserés | `--line`, `--line2` | gris sombres |
| Accent signal (action, actif, succès) | `--signal` + `--signal-rgb` | `#c6f542` |
| Travail / avertissement | `--amber` | `#ffb454` |
| Texte principal / secondaire / discret | `--ink`, `--dim`, `--faint` | blanc cassé → gris |

- 8 thèmes de couleur (vert, rouge, bleu, jaune, orange, violet, cyan, rose) : changer de thème = changer les tokens, jamais les composants
- Statuts : vert lime = actif/au travail, ambre = pause/attention, gris = inactif — jamais la couleur seule (toujours un libellé)

## TYPOGRAPHY : Space Grotesk / IBM Plex Mono

- `--disp` (Space Grotesk) : titres, noms, boutons, libellés d'interface
- `--mono` (IBM Plex Mono) : données, statuts, heures, compteurs, HUD, tags
- Tout en français, pas de jargon technique à l'écran

## KEY EFFECTS

- Survols discrets (liseré signal, léger décalage), voyants lumineux (`box-shadow` du signal), barres de progression, animation de pulsation uniquement sur l'état « au travail »
- Plan : déplacement/zoom sans à-coups, fils bezier, menu contextuel minimal

## AVOID (anti-patterns)

- Emojis comme icônes → uniquement SVG Papicons via `icon()`
- Couleurs codées en dur → uniquement les tokens
- Menus qui disparaissent avant qu'on puisse cliquer
- Texte tronqué sans accès à la valeur complète (les chips débordent en `+N`)
- Simulations d'activité : aucune fausse progression, tout est réel (clé API obligatoire)

## PRE-DELIVERY CHECKLIST (vérifier avant chaque livraison)

- [ ] Aucun emoji comme icône (SVG Papicons uniquement)
- [ ] `cursor:pointer` sur tout élément cliquable
- [ ] Contraste texte ≥ 4.5:1 sur les deux modes de fond
- [ ] États de focus visibles (`:focus-visible` liseré signal) pour la navigation clavier
- [ ] `prefers-reduced-motion` respecté (animations coupées)
- [ ] Textes, chips et badges se replient sans casser (test 375 px, 768 px, 1440 px)
- [ ] Tout nouveau bloc du plan : statut en direct + action réelle au clic + suppression (× ou clic droit)
- [ ] Persistance : nouvelles données dans `state` (sync compte) ou `localStorage` (local), jamais perdues au rechargement
- [ ] Rien ne fonctionne en mode simulation : sans clé API, aucune fausse activité
