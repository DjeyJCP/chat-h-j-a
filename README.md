# Chat Firebase (Público) — listo para GitHub + Vercel

## 1) Firestore Rules (IMPORTANTE para que sea permanente)
En Firebase Console → Firestore Database → Rules → Publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /messages/{docId} {
      allow read: if true;
      allow create: if
        request.resource.data.keys().hasOnly(['name','text','createdAt']) &&
        request.resource.data.name is string &&
        request.resource.data.text is string;
      allow update, delete: if false;
    }
  }
}
```

## 2) Subir a GitHub
- Crea repo
- Sube estos archivos tal cual

## 3) Deploy en Vercel
- Import Project (GitHub)
- Framework preset: Other
- Build command: vacío
- Output directory: vacío
- Deploy

## Nota realista
No hay “sin límite” absoluto: Firestore tiene límite de tamaño por documento (~1 MiB). Si alguien pega un testamento gigante, fallará.
