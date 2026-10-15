import 'server-only';
import { cache } from 'react';
import { isVisualModel, type ColorScheme, type InternalApp, type VisualModel } from '@/core/apps';
import { createServerSupabase } from '@/core/supabase/server';

export type UiPreference = { model: VisualModel; scheme: ColorScheme };

/** Modelo visual escolhido pelo usuário para o aplicativo neste restaurante. */
export const getUiPreference = cache(async (tenantId: string, app: InternalApp): Promise<UiPreference> => {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('ui_preferences').select('model, scheme').eq('tenant_id', tenantId).eq('app', app).maybeSingle();
  return {
    model: isVisualModel(data?.model) ? data.model : 'm1',
    scheme: (data?.scheme as ColorScheme | undefined) ?? 'system',
  };
});
