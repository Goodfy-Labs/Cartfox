const Currency = require('./currency.js');
const Handlebars = require('handlebars');
const Queue = require('./queue').Queue;
const jQuery = require('jquery');

window.Currency = window.Currency || {};

/** Class representing a cart */
export class Cart {
  /**
   * Build a new cart. Also creates a new queue.
   * Default selectors are:
   * cart: '.cart',
   * cartItemCount: "[data-cart-item-count]",
   * cartTotal: "[data-cart-total]",
   * decreaseQuantity: "#minusOne",
   * increaseQuantity: "#plusOne",
   * itemQuantity: "[data-item-quantity]",
   * staticQuantity: '.quantity',
   * staticChangeQuantity: '.adjust',
   * addItem: '.addItem',
   * removeItem: '[data-remove-item]',
   * updateItem: '.updateItem'
   * emptyTemplate: '[data-cart-template]'
   * itemsContainer: '[data-item-container]'
   * @param {object} cart - The json of the cart for the initial data. Can be set using liquid tags
   * with the json filter. {{ cart | json }}
   * @param {object} selectors - The selectors to update information and for events to listen to.
   */

  constructor(cart = {}, selectors, options) {
    this.queue = new Queue();
    this.cart = cart;
    this.selectors = Object.assign({}, {
      cart: '.cart',
      cartItemCount: '[data-cart-item-count]',
      cartTotal: '[data-cart-total]',
      decreaseQuantity: '[data-minus-one]',
      increaseQuantity: '[data-plus-one]',
      itemQuantity: '[data-item-quantity]',
      staticQuantity: '.quantity',
      staticChangeQuantity: '.adjust',
      addItem: '[data-add-to-cart]',
      removeItem: '[data-remove-item]',
      updateItem: '.updateItem',
      emptyTemplate: '[data-cart-template]',
      itemsContainer: '[data-item-container]',
    }, selectors);

    this.options = Object.assign({}, {
      'moneyFormat': '{{amount}}',
    }, options);

    //  Non Data API keys
    this.addItem = this.addItem.bind(this);
    this.removeItem = this.removeItem.bind(this);
    this.updateItemById = this.updateItemById.bind(this);
    this.updateCart = this.updateCart.bind(this);
    this.buildSelectors = this.buildSelectors.bind(this);

    this.buildSelectors(this.selectors);
  }

  /**
   * Build the event listeners and DOMElement selectors.
   * @param {object} selectors - An object that includes all the selectors to use.
   */
  buildSelectors(selectors) {
    /**
     * addItem - Event listener for when the additem event is triggered
     */
    function add(e) {
      e.preventDefault();
      const id = jQuery('select[name=id]').val();
      const quantity = Number(jQuery('input[name=quantity]').val());
      const properties = {};
      if (jQuery('input[name*=properties]').length > 0) {
        jQuery('input[name*=properties]').each(function property() {
          const key = jQuery(this).attr('name').split('[')[1].split(']')[0];
          const value = jQuery(this).val();
          properties[key] = value;
        });
      }
      this.addItem(id, quantity, properties);
    }

    function decreaseQuantity(e) {
      e.preventDefault();
      const qty = Number(jQuery(this).next(e.data.cart.selectors.itemQuantity).text()) - 1;
      const itemId = Number(jQuery(this).next(e.data.cart.selectors.itemQuantity).data('item-id'));
      e.data.cart.updateItemById(itemId, qty);
      if (qty >= 1) {
        jQuery(this).next(e.data.cart.selectors.itemQuantity).text(qty);
      }
    }

    function quickAdd(e) {
      e.preventDefault();
      const itemId = Number(jQuery(this).data('quick-add'));
      const qty = Number(jQuery(this).data('quick-add-qty')) || 1;
      var properties = jQuery(this).data('quick-add-properties');

      e.data.cart.addItem(itemId, qty, properties);
    }

    function increaseQuantity(e) {
      e.preventDefault();
      const qty = Number(jQuery(this).prev(e.data.cart.selectors.itemQuantity).text()) + 1;
      const itemId = Number(jQuery(this).prev(e.data.cart.selectors.itemQuantity).data('item-id'));
      e.data.cart.updateItemById(itemId, qty);
    }

    function remove(e) {
      e.preventDefault();
      const itemId = Number(jQuery(this).data('item-id'));
      e.data.cart.removeById(itemId);
    }

    function update(e) {
      e.preventDefault();
    }

    function staticChange(e) {
      e.preventDefault();
      var $this = jQuery(this);
      var $qtyInput = $this.siblings(selectors.staticQuantity);
      var change = Number($this.data('change'));
      var min = Number($qtyInput.attr('min'))
      var newQty = Number($qtyInput.val()) + change;
      if (newQty >= min) {
        $qtyInput.val(newQty);
      }
    }

    try {
      jQuery(document).on('click', selectors.addItem, add.bind(this));
      jQuery(document).on('click', selectors.updateItem, { cart: this }, update);
      jQuery(document).on('click', selectors.removeItem, { cart: this }, remove);
      jQuery(document).on('click', selectors.decreaseQuantity, { cart: this }, decreaseQuantity);
      jQuery(document).on('click', selectors.increaseQuantity, { cart: this }, increaseQuantity);
      jQuery(document).on('click', '[data-quick-add]', { cart: this }, quickAdd);
    } catch (e) {
      console.log('No document');
    }
  }

  static wrapKeys(obj, type = null, defaultValue = null) {
    const wrapped = {};
    Object.keys(obj).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (type === null) {
          wrapped[`${key}`] = defaultValue === null ? value : defaultValue;
        } else {
          wrapped[`${type}[${key}]`] = defaultValue === null ? value : defaultValue;
        }
      }
    });
    return wrapped;
  }

  /**
   * Get the cart
   */
  getCart(callback = null) {
    const options = {
      updateCart: true,
      success: callback || this.updateCart,
      type: 'GET',
    };
    this.queue.add('/cart.js', {}, options);
  }

  /**
   * Update cart
   * Fires jQuery event 'cartfox:cartUpdated' and passes the cart to the event when it has completed
   * @param {object} cart - Update the cart json in the object. Will also fire events that update
   * the quantity etc.
   */
  updateCart(cart, updateCart = true) {
    this.cart = cart;
    let moneyFormat = '{{amount}}';
    if (window.Currency.format) {
      if (window.Currency.moneyFormats) {
        const format = window.Currency.format;
        moneyFormat = window.Currency.moneyFormats[window.Currency.currentCurrency][format];
      }
    }
    if (!this.selectors.emptyTemplate) {
      jQuery(document).trigger('cartfox:cartUpdated', [this.cart]);
      jQuery(this.selectors.cartItemCount).each(function(index, element) {
        jQuery(element).text(this.cart.item_count);
      });
      jQuery(this.selectors.cartTotal).each(function(index, element) {
        jQuery(element).html(`<span class="money">${Currency.formatMoney(this.cart.total_price, moneyFormat)}</span>`);
      });
      return true;
    }
    const template = jQuery(this.selectors.emptyTemplate).html();
    const itemContainer = jQuery(this.selectors.itemsContainer);
    jQuery(itemContainer).html('');
    jQuery(this.selectors.cartItemCount).each(function(index, element) {
      jQuery(element).text(this.cart.item_count);
    });
    jQuery(this.selectors.cartTotal).each(function(index, element) {
      jQuery(element).html(`<span class="money">${Currency.formatMoney(this.cart.total_price, moneyFormat)}</span>`);
    });
    Handlebars.registerHelper('formatMoney', amount => new Handlebars.SafeString(`<span class='money'>${Currency.formatMoney(amount, moneyFormat)}</span>`));
    if (updateCart) { // This will update any cart html unless updateCart=false
      if (cart.items.length) {
        cart.items.forEach((lineItem) => {
          const itemTemplate = template;
          const renderedTemplate = Handlebars.compile(itemTemplate);
          renderedTemplate({ lineItem });
          const renderedHTML = renderedTemplate({ lineItem });
          jQuery(itemContainer).append(renderedHTML);
        });
      } else {
        jQuery(itemContainer).append('<p>Your cart is empty!</p>');
      }
    }
    Handlebars.unregisterHelper('formatMoney');
    jQuery(document).trigger('cartfox:cartUpdated', [this.cart]);
    if (window.Shopify && Shopify.StorefrontExpressButtons) {
      Shopify.StorefrontExpressButtons.initialize();
    }
    return true;
  }
  /**
   * Add an item to the cart. Fired when the selector for addItem is fired.
   * Fires a jQuery event cartfox:itemAdded.
   * @param {number} id - The variant or product id you want to add to the cart
   * @param {number} quantity - The quantity of the variant you want to add to the cart.
   * Defaults to 1 if set to less than 1.
   * @param {object} properties - The custom properties of the item.
   */
  addItem(id, quantity = 1, properties = {}) {
    if (id === undefined) {
      return false;
    }
    const data = {};
    data.id = id;
    data.quantity = quantity;
    if (properties !== {}) {
      data.properties = Cart.wrapKeys(properties);
    }
    this.queue.add('/cart/add.js', data, {
      success: lineItem => jQuery(document).trigger('cartfox:itemAdded', [lineItem])
    });
    return this.getCart();
  }

  removeItem(line) {
    const data = {};
    data.line = line;
    data.quantity = 0;
    this.queue.add('/cart/change.js', data, {});
    return this.getCart();
  }

  removeById(id) {
    const data = { updates: {} };
    data.updates[id] = 0;
    this.queue.add('/cart/update.js', data, {});
    return this.getCart();
  }

  updateItemById(id, quantity) {
    const data = { updates: {} };
    data.updates[id] = quantity;
    const options = {
      updateCart: true,
      success: [this.updateCart],
    };
    this.queue.add('/cart/update.js', data, options);
    return this.getCart();
  }

  updateItemsById(items, options = { success(response) { console.log(response); } }) {
    const data = {
      updates: items,
    };
    this.queue.add('/cart/update.js', data, options);
    return this.getCart();
  }

  /**
   * Set a cart attribute
   * @param {string} name
   * @param {string} value
   * @param {object} options
   * @returns Nothing
   */
  setAttribute(name, value, options = {}) {
    const attribute = {};
    attribute[name] = value;
    return this.setAttributes(attribute, options);
  }

  /**
   * Set multiple cart attributes by passing them in an object.
   * @param {object} attributes
   * @param {object} options
   */
  setAttributes(attrs = {}, options = {}) {
    if (attrs !== {}) {
      const attributes = Cart.wrapKeys(attrs, 'attributes');
      this.queue.add('/cart/update.js', attributes, options);
    }
    return this.getCart();
  }

  getAttribute(attribute, defaultValue = false) {
    const attributes = this.cart.attributes;
    return Object.prototype.hasOwnProperty.call(attributes,
                                                attribute) ? attributes[attribute] : defaultValue;
  }

  getAttributes() {
    return this.cart.attributes;
  }

  clearAttributes() {
    this.queue.add('/cart/update.js', Cart.wrapKeys(this.getAttributes(), 'attributes', ''));
    return this.getCart();
  }

  getNote() {
    return this.cart.note;
  }

  setNote(note, options = {}) {
    this.queue.add('/cart/update.js', { note }, options);
    return this.getCart();
  }

  clear() {
    this.queue.add('/cart/clear.js', {}, {});
    return this.getCart();
  }
}
