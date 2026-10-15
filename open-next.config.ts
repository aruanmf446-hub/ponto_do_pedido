import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Todas as páginas são dinâmicas (dados por restaurante e por sessão);
// não há ISR, portanto não é necessário cache incremental (R2/KV).
export default defineCloudflareConfig({});
