// Shopify Order Create webhook endpoint (static URL: /api/webhook/shopify/order/crt)
import { shopifyAdapter } from '../../../../src/lib/adapters/shopify/index.js';
import { callBitrix, getBitrixWebhookBase } from '../../../../src/lib/bitrix/client.js';
import { mapShopifyOrderToBitrixDeal } from '../../../../src/lib/bitrix/orderMapper.js';
import { upsertBitrixContact } from '../../../../src/lib/bitrix/contact.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

/**
 * Handle order created event - create deal in Bitrix
 */
async function handleOrderCreated(order) {
  console.log(`[SHOPIFY WEBHOOK] Handling order created: ${order.name || order.id}`);
  console.log(`[SHOPIFY WEBHOOK] Order data:`, {
    id: order.id,
    name: order.name,
    total_price: order.total_price,
    current_total_price: order.current_total_price,
    financial_status: order.financial_status,
    line_items_count: order.line_items?.length || 0
  });

  // Map order to Bitrix deal
  const { dealFields, productRows } = mapShopifyOrderToBitrixDeal(order);
  
  console.log(`[SHOPIFY WEBHOOK] Mapped dealFields:`, JSON.stringify(dealFields, null, 2));
  console.log(`[SHOPIFY WEBHOOK] Mapped productRows count:`, productRows.length);
  if (productRows.length > 0) {
    console.log(`[SHOPIFY WEBHOOK] First product row:`, JSON.stringify(productRows[0], null, 2));
  }

  // Upsert contact (non-blocking)
  let contactId = null;
  try {
    const bitrixBase = getBitrixWebhookBase();
    contactId = await upsertBitrixContact(bitrixBase, order);
    if (contactId) {
      dealFields.CONTACT_ID = contactId;
    }
  } catch (contactError) {
    console.error('[SHOPIFY WEBHOOK] Contact upsert failed (non-blocking):', contactError);
  }

  // 1. Create deal
  console.log(`[SHOPIFY WEBHOOK] Sending deal to Bitrix with fields:`, Object.keys(dealFields));
  const dealAddResp = await callBitrix('/crm.deal.add.json', {
    fields: dealFields,
  });

  console.log(`[SHOPIFY WEBHOOK] Bitrix response:`, JSON.stringify(dealAddResp, null, 2));

  if (!dealAddResp.result) {
    console.error(`[SHOPIFY WEBHOOK] ❌ Failed to create deal. Response:`, dealAddResp);
    throw new Error(`Failed to create deal: ${JSON.stringify(dealAddResp)}`);
  }

  const dealId = dealAddResp.result;
  console.log(`[SHOPIFY WEBHOOK] ✅ Deal created: ${dealId}`);

  // 2. Set product rows
  if (productRows.length > 0) {
    try {
      await callBitrix('/crm.deal.productrows.set.json', {
        id: dealId,
        rows: productRows,
      });
      console.log(`[SHOPIFY WEBHOOK] Product rows set for deal ${dealId}: ${productRows.length} rows`);
    } catch (productRowsError) {
      console.error(`[SHOPIFY WEBHOOK] Product rows error (non-blocking):`, productRowsError);
      // Don't throw - deal is already created
    }
  }

  return dealId;
}

export default async function handler(req, res) {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[SHOPIFY WEBHOOK ORDER/CRT] ===== INCOMING REQUEST [${requestId}] =====`);
  console.log(`[SHOPIFY WEBHOOK ORDER/CRT] [${requestId}] Method: ${req.method}`);
  
  if (req.method !== 'POST') {
    console.log(`[SHOPIFY WEBHOOK ORDER/CRT] [${requestId}] ❌ Method not allowed: ${req.method}`);
    res.status(405).end('Method not allowed');
    return;
  }

  const order = req.body;
  const orderId = order?.id || order?.order_id || order?.order?.id || 'N/A';
  const orderName = order?.name || order?.order_name || order?.order?.name || 'N/A';
  
  console.log(`[SHOPIFY WEBHOOK ORDER/CRT] [${requestId}] Order ID: ${orderId}`);
  console.log(`[SHOPIFY WEBHOOK ORDER/CRT] [${requestId}] Order Name: ${orderName}`);

  try {
    // Store event for monitoring (non-blocking)
    try {
      shopifyAdapter.storeEvent(order);
      console.log(`[SHOPIFY WEBHOOK ORDER/CRT] [${requestId}] ✅ Event stored. Order: ${orderName || orderId}`);
    } catch (storeError) {
      console.error(`[SHOPIFY WEBHOOK ORDER/CRT] [${requestId}] ⚠️ Failed to store event:`, storeError);
    }

    await handleOrderCreated(order);
    
    console.log(`[SHOPIFY WEBHOOK ORDER/CRT] [${requestId}] ✅ Request processed successfully`);
    res.status(200).json({ success: true, requestId, topic: 'orders/create' });
  } catch (e) {
    console.error(`[SHOPIFY WEBHOOK ORDER/CRT] [${requestId}] ❌ Error:`, e);
    console.error(`[SHOPIFY WEBHOOK ORDER/CRT] [${requestId}] Error stack:`, e.stack);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: e.message,
      requestId 
    });
  }
}

