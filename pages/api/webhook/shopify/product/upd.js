// Shopify Product Update webhook endpoint (static URL: /api/webhook/shopify/product/upd)
import { shopifyAdapter } from '../../../../src/lib/adapters/shopify/index.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

/**
 * Handle product updated event - update internal product catalog only
 * This handler updates SKU/handle → PRODUCT_ID mapping, Brand, Size, etc.
 * DOES NOT touch deals - only internal product reference data
 */
async function handleProductUpdated(product) {
  console.log(`[SHOPIFY WEBHOOK] Handling product updated: ${product.id || product.title}`);
  console.log(`[SHOPIFY WEBHOOK] Product data:`, {
    id: product.id,
    title: product.title,
    handle: product.handle,
    vendor: product.vendor,
    variants: product.variants?.length || 0
  });

  // TODO: Update internal product catalog (SKU/handle → PRODUCT_ID mapping)
  // This could update a database, file, or configuration
  // For now, just log the update
  // Example structure:
  // - Update SKU_TO_PRODUCT_ID mapping in config or external storage
  // - Store product metadata (Brand, Size, Model, etc.)
  // - Do NOT modify any deals
  
  if (product.variants && Array.isArray(product.variants)) {
    product.variants.forEach((variant, index) => {
      console.log(`[SHOPIFY WEBHOOK] Product variant ${index + 1}:`, {
        id: variant.id,
        sku: variant.sku,
        title: variant.title,
        price: variant.price,
        inventory_quantity: variant.inventory_quantity
      });
      // TODO: Update SKU mapping here
      // Example: updateProductMapping(variant.sku, { productId, brand, size, etc. })
    });
  }

  console.log(`[SHOPIFY WEBHOOK] ✅ Product catalog update processed (no deals affected)`);
  return true;
}

export default async function handler(req, res) {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[SHOPIFY WEBHOOK PRODUCT/UPD] ===== INCOMING REQUEST [${requestId}] =====`);
  console.log(`[SHOPIFY WEBHOOK PRODUCT/UPD] [${requestId}] Method: ${req.method}`);
  
  if (req.method !== 'POST') {
    console.log(`[SHOPIFY WEBHOOK PRODUCT/UPD] [${requestId}] ❌ Method not allowed: ${req.method}`);
    res.status(405).end('Method not allowed');
    return;
  }

  const product = req.body;
  const productId = product?.id || product?.product_id || 'N/A';
  const productTitle = product?.title || product?.product_title || 'N/A';
  
  console.log(`[SHOPIFY WEBHOOK PRODUCT/UPD] [${requestId}] Product ID: ${productId}`);
  console.log(`[SHOPIFY WEBHOOK PRODUCT/UPD] [${requestId}] Product Title: ${productTitle}`);

  try {
    try {
      shopifyAdapter.storeEvent(product);
      console.log(`[SHOPIFY WEBHOOK PRODUCT/UPD] [${requestId}] ✅ Event stored. Product: ${productTitle || productId}`);
    } catch (storeError) {
      console.error(`[SHOPIFY WEBHOOK PRODUCT/UPD] [${requestId}] ⚠️ Failed to store event:`, storeError);
    }

    await handleProductUpdated(product);
    
    console.log(`[SHOPIFY WEBHOOK PRODUCT/UPD] [${requestId}] ✅ Request processed successfully`);
    res.status(200).json({ success: true, requestId, topic: 'products/update' });
  } catch (e) {
    console.error(`[SHOPIFY WEBHOOK PRODUCT/UPD] [${requestId}] ❌ Error:`, e);
    console.error(`[SHOPIFY WEBHOOK PRODUCT/UPD] [${requestId}] Error stack:`, e.stack);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: e.message,
      requestId 
    });
  }
}

