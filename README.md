# Chat público (Firebase Firestore) + Subida de fotos/vídeos (Cloudinary GRATIS)

## Por qué así
- Firebase Storage en proyectos nuevos suele requerir activar facturación.
- Cloudinary tiene plan **Free** con **no credit card required**. (Ojo: tiene cuotas/créditos.) 

## 1) Cloudinary (configurar 1 vez)
1. Crea cuenta (Free).
2. Entra al panel y busca tu **Cloud name**.
3. Crea un **Upload preset** en modo **Unsigned**:
   - Settings → Upload → Upload presets → Add upload preset
   - “Signing Mode”: **Unsigned**
   - Allowed formats: images + videos (o deja auto)
4. Copia el nombre del preset.

Luego, en `app.js` pon:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_UPLOAD_PRESET`

## 2) Firestore Rules (para permitir media)
Firebase Console → Firestore Database → Rules → Publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /messages/{docId} {
      allow read: if true;
      allow create: if
        request.resource.data.keys().hasOnly([
          'name','text','createdAt',
          'mediaUrl','mediaKind','mediaContentType','mediaPublicId','mediaBytes'
        ]) &&
        request.resource.data.name is string &&
        request.resource.data.text is string;
      allow update, delete: if false;
    }
  }
}
```

## 3) GitHub + Vercel
- Sube al repo
- Vercel: Import Project → Deploy

## Nota
Este chat es público: cualquiera con el enlace puede subir archivos (a tu cuenta de Cloudinary). Si se filtra, te pueden gastar la cuota del plan gratis.


## Config ya puesta
- CLOUDINARY_CLOUD_NAME = dsavymd9i
- CLOUDINARY_UPLOAD_PRESET = chat-h-j-a


## Firestore Rules (añadir typing indicator)
Además de `messages`, este chat usa una colección `typing` para mostrar “X está escribiendo…”.
Añade estas rules (o integra el bloque `typing` en tus rules actuales):

```
match /typing/{id} {
  allow read: if true;
  allow create, update: if
    request.resource.data.keys().hasOnly(['name','isTyping','updatedAt']) &&
    request.resource.data.name is string &&
    request.resource.data.isTyping is bool;
  allow delete: if true;
}
```

Si no añades este bloque, el chat seguirá funcionando pero no aparecerá el indicador.


## Audio (nota de voz)
- Botón 🎙: mantén pulsado para grabar, suelta para enviar.
- Se sube a Cloudinary igual que fotos/vídeos y se guarda en Firestore como media.
