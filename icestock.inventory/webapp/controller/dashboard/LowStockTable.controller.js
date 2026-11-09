sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], (BaseController, JSONModel) => {
  "use strict";

  return BaseController.extend("icestock.inventory.icestock.inventory.controller.dashboard.LowStockTable", {
      onInit() {
        this._oInventoryModel = this.getOwnerComponent().getModel("inventory");
        this._oEventBus = this.getOwnerComponent().getEventBus();
        this._oLowStockModel = new JSONModel({ products: [] });
        this.getView().setModel(this._oLowStockModel, "lowStock");

        this._oInventoryModel.dataLoaded().then(() => {
          this._refreshLowStockProducts();
          this._oEventBus.subscribe("inventory", "changed", this._refreshLowStockProducts, this);
        });
      },

      onExit() {
        if (this._oEventBus) {
          this._oEventBus.unsubscribe("inventory", "changed", this._refreshLowStockProducts, this);
        }
      },

      _refreshLowStockProducts() {
        const aProducts = this._oInventoryModel.getProperty("/products") || [];
        const aMovements = this._oInventoryModel.getProperty("/movements") || [];
        const oLatestMovementByProduct = {};
        const aLowStockProducts = [];

        aMovements.forEach((oMovement) => {
          const oLatestMovement = oLatestMovementByProduct[oMovement.productId];
          const iMovementNumber = Number(String(oMovement.movementId).replace("M", ""));
          const iLatestMovementNumber = oLatestMovement
            ? Number(String(oLatestMovement.movementId).replace("M", ""))
            : -1;

          if (iMovementNumber > iLatestMovementNumber) {
            oLatestMovementByProduct[oMovement.productId] = oMovement;
          }
        });

        aProducts.forEach((oProduct) => {
          const oLatestMovement = oLatestMovementByProduct[oProduct.productId];
          const iStock = oLatestMovement ? oLatestMovement.afterStock : oProduct.stock;

          if (iStock < oProduct.safetyStock) {
            aLowStockProducts.push({ ...oProduct, stock: iStock, status: "부족" });
          }
        });

        this._oLowStockModel.setProperty("/products", aLowStockProducts);
      }
  });
});