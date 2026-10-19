'use client';

import { useRef, useState } from 'react';

export function ProfilePhotoControl({ hasPhoto }: { hasPhoto: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function upload(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError('Escolha JPG, PNG ou WebP de até 2 MB.');
      return;
    }
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/profile/avatar', { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!response.ok) throw new Error('Não foi possível salvar a foto.');
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao salvar foto.');
    } finally { setBusy(false); }
  }
  return (
    <div className="pdp-profile-photo-control">
      <input ref={input} aria-label="Selecionar foto de perfil" type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void upload(e.target.files?.[0])} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Enviando foto…' : hasPhoto ? 'Trocar foto de perfil' : 'Adicionar foto de perfil'}</button>
      {error ? <span role="alert" style={{ display: 'block', fontSize: 12 }}>{error}</span> : null}
    </div>
  );
}
