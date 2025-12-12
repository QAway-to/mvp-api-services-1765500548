// Shopify Order Update webhook endpoint (static URL: /api/webhook/shopify/order/upd)
import { shopifyAdapter } from '../../../../src/lib/adapters/shopify/index.js';
import { callBitrix, getBitrixWebhookBase } from '../../../../src/lib/bitrix/client.js';
import { mapShopifyOrderToBitrixDeal } from '../../../../src/lib/bitrix/orderMapper.js';
import { upsertBitrixContact } from '../../../../src/lib/bitrix/contact.js';
import { BITRIX_CONFIG, financialStatusToStageId, financialStatusToPaymentStatus } from '../../../../src/lib/bitrix/config.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

/**
 * Handle order updated event - update deal in Bitrix
 * This is the MAIN TRIGGER for:
 * - Updating product rows in deal
 * - Recalculating totals/discounts/taxes
 * - Updating payment status and stage
 * - Handling partial/full refunds
 */
async function handleOrderUpdated(order) {
  console.log(`[SHOPIFY WEBHOOK] Handling order updated: ${order.name || order.id}`);
  console.log(`[SHOPIFY WEBHOOK] Order data:`, {
    id: order.id,
    name: order.name,
    financial_status: order.financial_status,
    total_price: order.total_price,
    current_total_price: order.current_total_price,
    line_items_count: order.line_items?.length || 0
  });

  const shopifyOrderId = String(order.id);

  // 1. Find existing deal by UF_SHOPIFY_ORDER_ID
  const listResp = await callBitrix('/crm.deal.list.json', {
    filter: { 
      'UF_SHOPIFY_ORDER_ID': shopifyOrderId,
    },
    select: ['ID', 'OPPORTUNITY', 'STAGE_ID', 'CATEGORY_ID', 'DATE_CREATE'],
    order: { 'DATE_CREATE': 'DESC' },
  });

  const deals = listResp.result || [];
  const dealsCount = deals.length;

  console.log(`[SHOPIFY WEBHOOK] Found ${dealsCount} deal(s) for order ${shopifyOrderId}`);

  let dealId = null;
  let deal = null;

  if (dealsCount === 0) {
    // No deal found - CREATE NEW DEAL
    console.log(`[SHOPIFY WEBHOOK] ⚠️ No deal found for order ${shopifyOrderId}. Creating new deal...`);
    
    const orderTags = Array.isArray(order.tags) 
      ? order.tags 
      : (order.tags ? String(order.tags).split(',').map(t => t.trim()) : []);
    
    const preorderTags = ['pre-order', 'preorder-product-added'];
    const hasPreorderTag = orderTags.some(tag => 
      preorderTags.some(preorderTag => tag.toLowerCase() === preorderTag.toLowerCase())
    );
    
    const categoryId = hasPreorderTag ? BITRIX_CONFIG.CATEGORY_PREORDER : BITRIX_CONFIG.CATEGORY_STOCK;

    const { dealFields, productRows } = mapShopifyOrderToBitrixDeal(order);
    dealFields.CATEGORY_ID = categoryId;
    dealFields.UF_SHOPIFY_ORDER_ID = shopifyOrderId;

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

    const dealAddResp = await callBitrix('/crm.deal.add.json', {
      fields: dealFields,
    });

    if (!dealAddResp.result) {
      console.error(`[SHOPIFY WEBHOOK] ❌ Failed to create deal. Response:`, dealAddResp);
      throw new Error(`Failed to create deal: ${JSON.stringify(dealAddResp)}`);
    }

    dealId = dealAddResp.result;
    console.log(`[SHOPIFY WEBHOOK] ✅ New deal created: ${dealId}`);

    if (productRows && productRows.length > 0) {
      await callBitrix('/crm.deal.productrows.set.json', {
        id: dealId,
        rows: productRows,
      });
      console.log(`[SHOPIFY WEBHOOK] Product rows set for new deal ${dealId}: ${productRows.length} rows`);
    }

    return dealId;

  } else if (dealsCount === 1) {
    deal = deals[0];
    dealId = deal.ID;
    const currentCategoryId = Number(deal.CATEGORY_ID) || 2;
    console.log(`[SHOPIFY WEBHOOK] ✅ Found exactly one deal ${dealId} for order ${shopifyOrderId}, category: ${currentCategoryId}`);

  } else {
    console.error(`[SHOPIFY WEBHOOK] ⚠️ DATA ERROR: Found ${dealsCount} deals for order ${shopifyOrderId}!`);
    console.error(`[SHOPIFY WEBHOOK] Deal IDs:`, deals.map(d => d.ID).join(', '));
    deal = deals[0];
    dealId = deal.ID;
    const currentCategoryId = Number(deal.CATEGORY_ID) || 2;
    console.log(`[SHOPIFY WEBHOOK] Updating deal ${dealId} (most recent), category: ${currentCategoryId}`);
  }

  // 2. UPDATE EXISTING DEAL
  const currentCategoryId = Number(deal.CATEGORY_ID) || 2;

  const orderTags = Array.isArray(order.tags) 
    ? order.tags 
    : (order.tags ? String(order.tags).split(',').map(t => t.trim()) : []);
  
  const preorderTags = ['pre-order', 'preorder-product-added'];
  const hasPreorderTag = orderTags.some(tag => 
    preorderTags.some(preorderTag => tag.toLowerCase() === preorderTag.toLowerCase())
  );
  
  const categoryId = hasPreorderTag ? BITRIX_CONFIG.CATEGORY_PREORDER : BITRIX_CONFIG.CATEGORY_STOCK;

  const { dealFields: mappedFields } = mapShopifyOrderToBitrixDeal(order);
  
  const fields = {
    OPPORTUNITY: mappedFields.OPPORTUNITY,
    UF_SHOPIFY_TOTAL_DISCOUNT: mappedFields.UF_SHOPIFY_TOTAL_DISCOUNT || 0,
    UF_SHOPIFY_TOTAL_TAX: mappedFields.UF_SHOPIFY_TOTAL_TAX || 0,
    UF_SHOPIFY_SHIPPING_PRICE: mappedFields.UF_SHOPIFY_SHIPPING_PRICE || 0,
  };

  if (categoryId !== currentCategoryId) {
    fields.CATEGORY_ID = categoryId;
    console.log(`[SHOPIFY WEBHOOK] Category changed from ${currentCategoryId} to ${categoryId}`);
  }

  const stageId = financialStatusToStageId(order.financial_status, categoryId);
  fields.STAGE_ID = stageId;
  if (stageId !== deal.STAGE_ID) {
    console.log(`[SHOPIFY WEBHOOK] Stage updated: "${deal.STAGE_ID}" → "${stageId}"`);
  }

  const paymentStatusEnumId = financialStatusToPaymentStatus(order.financial_status);
  fields.UF_CRM_1739183959976 = paymentStatusEnumId;
  console.log(`[SHOPIFY WEBHOOK] Payment status: "${paymentStatusEnumId}" (financial_status: ${order.financial_status})`);

  if (mappedFields.UF_CRM_1739183268662) {
    fields.UF_CRM_1739183268662 = mappedFields.UF_CRM_1739183268662;
  }
  if (mappedFields.UF_CRM_1739183302609) {
    fields.UF_CRM_1739183302609 = mappedFields.UF_CRM_1739183302609;
  }

  console.log(`[SHOPIFY WEBHOOK] Updating deal ${dealId} with fields:`, Object.keys(fields));
  await callBitrix('/crm.deal.update.json', {
    id: dealId,
    fields,
  });
  console.log(`[SHOPIFY WEBHOOK] ✅ Deal ${dealId} updated successfully`);

  // 4. ALWAYS UPDATE PRODUCT ROWS
  try {
    const { productRows } = mapShopifyOrderToBitrixDeal(order);
    console.log(`[SHOPIFY WEBHOOK] Updating product rows for deal ${dealId}: ${productRows?.length || 0} rows`);
    
    await callBitrix('/crm.deal.productrows.set.json', {
      id: dealId,
      rows: productRows || [],
    });
    console.log(`[SHOPIFY WEBHOOK] ✅ Product rows updated for deal ${dealId}: ${productRows?.length || 0} rows`);
  } catch (productRowsError) {
    console.error(`[SHOPIFY WEBHOOK] ❌ Product rows update error:`, productRowsError);
  }

  return dealId;
}

export default async function handler(req, res) {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[SHOPIFY WEBHOOK ORDER/UPD] ===== INCOMING REQUEST [${requestId}] =====`);
  console.log(`[SHOPIFY WEBHOOK ORDER/UPD] [${requestId}] Method: ${req.method}`);
  
  if (req.method !== 'POST') {
    console.log(`[SHOPIFY WEBHOOK ORDER/UPD] [${requestId}] ❌ Method not allowed: ${req.method}`);
    res.status(405).end('Method not allowed');
    return;
  }

  const order = req.body;
  const orderId = order?.id || order?.order_id || order?.order?.id || 'N/A';
  const orderName = order?.name || order?.order_name || order?.order?.name || 'N/A';
  
  console.log(`[SHOPIFY WEBHOOK ORDER/UPD] [${requestId}] Order ID: ${orderId}`);
  console.log(`[SHOPIFY WEBHOOK ORDER/UPD] [${requestId}] Order Name: ${orderName}`);

  try {
    try {
      shopifyAdapter.storeEvent(order);
      console.log(`[SHOPIFY WEBHOOK ORDER/UPD] [${requestId}] ✅ Event stored. Order: ${orderName || orderId}`);
    } catch (storeError) {
      console.error(`[SHOPIFY WEBHOOK ORDER/UPD] [${requestId}] ⚠️ Failed to store event:`, storeError);
    }

    await handleOrderUpdated(order);
    
    console.log(`[SHOPIFY WEBHOOK ORDER/UPD] [${requestId}] ✅ Request processed successfully`);
    res.status(200).json({ success: true, requestId, topic: 'orders/updated' });
  } catch (e) {
    console.error(`[SHOPIFY WEBHOOK ORDER/UPD] [${requestId}] ❌ Error:`, e);
    console.error(`[SHOPIFY WEBHOOK ORDER/UPD] [${requestId}] Error stack:`, e.stack);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: e.message,
      requestId 
    });
  }
}

