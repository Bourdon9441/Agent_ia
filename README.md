# Agent_ia

Centre de contrôle pour assistants IA : un « Patron » qui distribue les tâches et jusqu'à 10 agents qui les exécutent, en mode autonome.

🌐 **En ligne : https://bourdon9441.github.io/Agent_ia/**

## Fonctionnalités

- **Le Patron** : reçoit vos objectifs, les découpe en tâches et les distribue automatiquement aux agents libres.
- **1 à 10 agents** : nom, spécialité, file de tâches, barre de progression, journal, pause/retrait.
- **Mode autonome** : cycles de travail relancés en continu à partir de la mission principale — fonctionne même en votre absence (onglet laissé ouvert).
- **IA réelle (optionnel)** : clé API Mistral dans les réglages. Sans clé, mode simulation réaliste. La clé reste dans votre navigateur, elle n'est jamais synchronisée.
- **Connexion & synchro multi-appareils (optionnel)** : GitHub, Google (Gmail), Microsoft (Outlook) ou lien e-mail, via Supabase.
- Design : vocabulaire [Impeccable](https://github.com/pbakaus/impeccable) · icônes [Papicons](https://github.com/PapillonApp/Papicons) (MIT).

## Activer la connexion multi-appareils (gratuit, ~2 min)

La page fonctionne sans compte (mode local). Pour se connecter et synchroniser entre appareils :

1. Créez un compte gratuit sur [supabase.com](https://supabase.com) et créez un projet.
2. Dans **SQL Editor**, exécutez :
   ```sql
   create table if not exists agent_workspaces (
     id uuid primary key references auth.users(id) on delete cascade,
     data jsonb not null default '{}'::jsonb,
     updated_at timestamptz not null default now()
   );
   alter table agent_workspaces enable row level security;
   create policy "proprietaire"
     on agent_workspaces for all
     using (auth.uid() = id)
     with check (auth.uid() = id);
   ```
3. Dans **Project Settings → API**, copiez « Project URL » et « anon public key ».
4. Sur la page : **Se connecter** → collez les deux valeurs → enregistrez. Les boutons GitHub / Google / Outlook / e-mail apparaissent.
5. *(Optionnel)* Pour les connexions GitHub / Google / Outlook : dans Supabase → **Authentication → Providers**, activez chaque fournisseur et configurez l'application OAuth correspondante. Le lien e-mail (« magic link ») fonctionne immédiatement sans configuration.

## Développement

Page unique `index.html`, aucune installation : ouvrir le fichier dans un navigateur.
