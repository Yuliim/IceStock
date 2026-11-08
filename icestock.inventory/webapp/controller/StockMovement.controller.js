sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/FilterType",
  "sap/ui/model/Sorter"
], (BaseController, Filter, FilterOperator, FilterType, Sorter) => {
  "use strict";

  return BaseController.extend("icestock.inventory.icestock.inventory.controller.StockMovement", {
      onInit() {
        const oInventoryModel = this.getOwnerComponent().getModel("inventory");
        oInventoryModel.attachRequestCompleted(() => this._sortMovements());
        this._sortMovements();
      },

      onFilterChange() {
        this._applyFilters();
      },

      onResetFilters() {
        this.byId("movementSearchField").setValue("");
        this.byId("movementStartDate").setDateValue(null);
        this.byId("movementEndDate").setDateValue(null);
        this.byId("movementTypeSelect").setSelectedKey("ALL");
        this.byId("movementReasonSelect").setSelectedKey("ALL");
        this.byId("movementSortSelect").setSelectedKey("LATEST");
        this._applyFilters();
      },

      _applyFilters() {
        const oBinding = this.byId("stockMovementTable").getBinding("rows");
        if (!oBinding) {
          return;
        }

        const oModel = this.getOwnerComponent().getModel("inventory");
        const aProducts = oModel.getProperty("/products") || [];
        const sSearchValue = this.byId("movementSearchField").getValue().trim().toLowerCase();
        const oStartDate = this.byId("movementStartDate").getDateValue();
        const oEndDate = this.byId("movementEndDate").getDateValue();
        const aFilters = [];

        if (sSearchValue) {
          aFilters.push(new Filter({
            path: "productId",
            test: (sProductId) => {
              const oProduct = aProducts.find((oItem) => oItem.productId === sProductId);
              return sProductId.toLowerCase().includes(sSearchValue) ||
                (oProduct && oProduct.productName.toLowerCase().includes(sSearchValue));
            }
          }));
        }

        if (oStartDate || oEndDate) {
          const sStartDate = oStartDate ? this._formatFilterDate(oStartDate) : "0000-01-01";
          const sEndDate = oEndDate ? this._formatFilterDate(oEndDate) : "9999-12-31";
          aFilters.push(new Filter({
            path: "date",
            test: (sDate) => sDate >= sStartDate && sDate <= sEndDate
          }));
        }

        const sType = this.byId("movementTypeSelect").getSelectedKey();
        if (sType !== "ALL") {
          aFilters.push(new Filter("type", FilterOperator.EQ, sType));
        }

        const sReason = this.byId("movementReasonSelect").getSelectedKey();
        if (sReason !== "ALL") {
          aFilters.push(new Filter("reason", FilterOperator.EQ, sReason));
        }

        oBinding.filter(aFilters, FilterType.Application);
        this._applySort(oBinding);
        this.byId("movementCount").setText(`(${oBinding.getLength()}건)`);
      },

      _applySort(oBinding) {
        const sSortKey = this.byId("movementSortSelect").getSelectedKey();
        if (sSortKey === "OLDEST") {
          oBinding.sort(new Sorter("date", false));
          return;
        }
        if (sSortKey === "QUANTITY_DESC") {
          oBinding.sort(new Sorter("quantity", true));
          return;
        }
        if (sSortKey === "QUANTITY_ASC") {
          oBinding.sort(new Sorter("quantity", false));
          return;
        }
        if (sSortKey === "SALES") {
          oBinding.sort(new Sorter("reason", false, false, (sLeft, sRight) => {
            if (sLeft === sRight) {
              return 0;
            }
            return sLeft === "SALE" ? -1 : 1;
          }));
          return;
        }
        oBinding.sort(new Sorter("date", true));
      },

      _formatFilterDate(oDate) {
        const iMonth = String(oDate.getMonth() + 1).padStart(2, "0");
        const iDay = String(oDate.getDate()).padStart(2, "0");
        return `${oDate.getFullYear()}-${iMonth}-${iDay}`;
      },

      _sortMovements() {
        const oModel = this.getOwnerComponent().getModel("inventory");
        const aMovements = oModel.getProperty("/movements");
        if (!Array.isArray(aMovements)) {
          return;
        }

        aMovements.sort((oLeft, oRight) => {
          const iDateOrder = oRight.date.localeCompare(oLeft.date);
          if (iDateOrder !== 0) {
            return iDateOrder;
          }
          return oRight.movementId.localeCompare(oLeft.movementId, undefined, { numeric: true });
        });
        oModel.setProperty("/movements", aMovements);
      },

      // formatDate(sDate) {
      //   return sDate ? sDate.replace(/-/g, ".") : "";
      // },

      formatProductLabel(sProductId, aProducts) {
        const oProduct = (aProducts || []).find((oItem) => oItem.productId === sProductId);
        return `${oProduct ? oProduct.productName : sProductId}(${sProductId})`;
      },

      formatType(sType) {
        return sType === "IN" ? "입고" : "출고";
      },

      formatTypeState(sType) {
        return sType === "IN" ? "Success" : "Error";
      },

      formatReason(sReason) {
        const mReasonLabels = {
          PURCHASE: "매입",
          SALE: "판매",
          DISCARD: "폐기"
        };
        return mReasonLabels[sReason] || sReason;
      },

      formatQuantity(sType, iQuantity) {
        if (iQuantity === undefined || iQuantity === null) {
          return "";
        }
        return `${sType === "IN" ? "+" : "-"}${iQuantity}개`;
      }
  });
});