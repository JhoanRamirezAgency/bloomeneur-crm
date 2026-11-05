# 2026-11-06 · Compradores de Shopify al CRM (aplicado directo en Supabase)

Migración `shopify_buyers_to_crm` aplicada en el proyecto gxzkangdmhvbluvhnodm.

- `sync_shopify_buyers()` (pg_cron `sync-shopify-buyers`, minuto 15 de cada hora):
  lee los pedidos de Shopify (bloomeneur.myshopify.com, mismas credenciales de Vault que
  `sync_shopify_refunds`). Por cada pedido real (no cancelado, valor > 0, PAID /
  PARTIALLY_PAID / PARTIALLY_REFUNDED, sin correos @bloomeneur.com):
  - si el comprador ya es lead (por email o por los últimos 10 dígitos del teléfono)
    → pasa a `Customer` y se agrega la compra en `notes`;
  - si no existe → se crea como lead `Customer` (source `Shopify`, platform `sh`,
    asignado a Marcela).
  - Cada pedido se registra en `shopify_order_sync` para no procesarlo dos veces.
  - Límite: la app de Shopify no tiene `read_all_orders`, así que solo ve los pedidos
    de los últimos 60 días.
- `force_assign_new_leads_to_marcela()`: el reparto 70/30 ya no cuenta los leads de
  source `Shopify`.
- `sync_leads_from_sheet()`: no vuelve a crear registros listados en
  `lead_sync_ignore` (duplicados unidos) ni leads cuyo teléfono ya existe.
- `phone_key(text)`: últimos 10 dígitos de un teléfono.
