// Shopify Refund Create webhook endpoint (static URL: /api/webhook/shopify/refund/crt)
import { shopifyAdapter } from '../../../../src/lib/adapters/shopify/index.js';
import { callBitrix } from '../../../../src/lib/bitrix/client.js';
import { mapShopifyOrderToBitrixDeal } from '../../../../src/lib/bitrix/orderMapper.js';
import { financialStatusToStageId } from '../../../../src/lib/bitrix/config.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

/**
 * Handle refund created event - update deal in Bitrix
 * Note: Shopify refund webhook sends refund object, not order object
 */
async function handleRefundCreated(refundData) {
  console.log(`[SHOPIFY WEBHOOK] Handling refund created`);
  console.log(`[SHOPIFY WEBHOOK] Refund data:`, {
    order_id: refundData.order_id,
    refund_id: refundData.id,
    amount: refundData.amount,
    currency: refundData.currency,
    refund_line_items: refundData.refund_line_items?.length || 0
  });

  const shopifyOrderId = String(refundData.order_id);
  
  // 1. Find deal by UF_SHOPIFY_ORDER_ID
  const listResp = await callBitrix('/crm.deal.list.json', {
    filter: { 'UF_SHOPIFY_ORDER_ID': shopifyOrderId },
    select: ['ID', 'OPPORTUNITY', 'STAGE_ID', 'CATEGORY_ID'],
  });

  const deal = listResp.result?.[0];
  if (!deal) {
    console.log(`[SHOPIFY WEBHOOK] Deal not found for Shopify order ${shopifyOrderId}`);
    return;
  }

  const dealId = deal.ID;
  const currentCategoryId = Number(deal.CATEGORY_ID) || 2;
  console.log(`[SHOPIFY WEBHOOK] Found deal ${dealId} for refund on order ${shopifyOrderId}`);

  // 2. Get full order from Shopify to recalculate totals
  try {
    const { getOrder } = await import('../../../../src/lib/shopify/adminClient.js');
    const shopifyOrder = await getOrder(shopifyOrderId);
    
    if (!shopifyOrder) {
      console.error(`[SHOPIFY WEBHOOK] Order ${shopifyOrderId} not found in Shopify`);
      return;
    }

    // 3. Recalculate deal amount and product rows based on current order state (after refund)
    const { dealFields, productRows } = mapShopifyOrderToBitrixDeal(shopifyOrder);
    
    // 4. Update deal with new amount and product rows
    const fields = {
      OPPORTUNITY: dealFields.OPPORTUNITY,
      UF_SHOPIFY_TOTAL_DISCOUNT: dealFields.UF_SHOPIFY_TOTAL_DISCOUNT,
      UF_SHOPIFY_SHIPPING_PRICE: dealFields.UF_SHOPIFY_SHIPPING_PRICE,
      UF_SHOPIFY_TOTAL_TAX: dealFields.UF_SHOPIFY_TOTAL_TAX,
    };

    // Update payment status based on refund
    const refundAmount = Number(refundData.amount || 0);
    const orderTotal = Number(shopifyOrder.total_price || 0);
    const remainingAmount = orderTotal - refundAmount;
    
    if (remainingAmount <= 0) {
      // Full refund
      fields.UF_CRM_1739183959976 = '58'; // Unpaid
      fields.STAGE_ID = financialStatusToStageId('refunded', currentCategoryId);
    } else if (refundAmount > 0) {
      // Partial refund
      fields.UF_CRM_1739183959976 = '58'; // Unpaid (or could be '60' for partial)
    }

    await callBitrix('/crm.deal.update.json', {
      id: dealId,
      fields,
    });
    console.log(`[SHOPIFY WEBHOOK] Deal ${dealId} updated after refund`);

    // 5. Update product rows to reflect refunded quantities
    if (productRows && productRows.length > 0) {
      await callBitrix('/crm.deal.productrows.set.json', {
        id: dealId,
        rows: productRows,
      });
      console.log(`[SHOPIFY WEBHOOK] Product rows updated for deal ${dealId} after refund: ${productRows.length} rows`);
    }

  } catch (error) {
    console.error(`[SHOPIFY WEBHOOK] Error processing refund:`, error);
    // Don't throw - refund is already processed in Shopify
  }

  return dealId;
}

export default async function handler(req, res) {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[SHOPIFY WEBHOOK REFUND/CRT] ===== INCOMING REQUEST [${requestId}] =====`);
  console.log(`[SHOPIFY WEBHOOK REFUND/CRT] [${requestId}] Method: ${req.method}`);
  
  if (req.method !== 'POST') {
    console.log(`[SHOPIFY WEBHOOK REFUND/CRT] [${requestId}] ❌ Method not allowed: ${req.method}`);
    res.status(405).end('Method not allowed');
    return;
  }

  const refundData = req.body;
  const refundId = refundData?.id || refundData?.refund_id || 'N/A';
  const orderId = refundData?.order_id || 'N/A';
  
  console.log(`[SHOPIFY WEBHOOK REFUND/CRT] [${requestId}] Refund ID: ${refundId}`);
  console.log(`[SHOPIFY WEBHOOK REFUND/CRT] [${requestId}] Order ID: ${orderId}`);

  try {
    try {
      shopifyAdapter.storeEvent(refundData);
      console.log(`[SHOPIFY WEBHOOK REFUND/CRT] [${requestId}] ✅ Event stored. Refund: ${refundId}, Order: ${orderId}`);
    } catch (storeError) {
      console.error(`[SHOPIFY WEBHOOK REFUND/CRT] [${requestId}] ⚠️ Failed to store event:`, storeError);
    }

    await handleRefundCreated(refundData);
    
    console.log(`[SHOPIFY WEBHOOK REFUND/CRT] [${requestId}] ✅ Request processed successfully`);
    res.status(200).json({ success: true, requestId, topic: 'refunds/create' });
  } catch (e) {
    console.error(`[SHOPIFY WEBHOOK REFUND/CRT] [${requestId}] ❌ Error:`, e);
    console.error(`[SHOPIFY WEBHOOK REFUND/CRT] [${requestId}] Error stack:`, e.stack);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: e.message,
      requestId 
    });
  }
}

