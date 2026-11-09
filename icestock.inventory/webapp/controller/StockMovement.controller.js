sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/FilterType",
  "sap/ui/model/Sorter",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], (BaseController, Filter, FilterOperator, FilterType, Sorter, MessageBox, MessageToast) => {
  "use strict";

  return BaseController.extend("icestock.inventory.icestock.inventory.controller.StockMovement", {
      onInit() {
        const oInventoryModel = this.getOwnerComponent().getModel("inventory");
        oInventoryModel.attachRequestCompleted(() => {
          this._sortMovements();
        });
        this._sortMovements();
        this.byId("movementRegisterDate").setDateValue(new Date());
        this._updateRegisterButton();
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

      onRegisterTypeChange() {
        this._updateRegisterButton();
        this._updateRegisterStock();
      },

      onRegisterProductChange() {
        const oProductInput = this.byId("movementRegisterProduct");
        const oSelectedItem = oProductInput.getSelectedItem();
        oProductInput.setValueState("None");
        if (!oSelectedItem) {
          this.byId("movementRegisterCurrentStock").setText("상품을 선택하세요");
          return;
        }
        this._updateRegisterStock();
      },

      onRegisterMovement() {
        const oFormData = this._getRegisterFormData();
        if (!oFormData) {
          return;
        }

        const { oProduct, iQuantity, sType } = oFormData;
        const sMovementType = sType === "IN" ? "입고" : "출고";
        MessageBox.confirm(
          `${oProduct.productName} 상품을 ${iQuantity}개 ${sMovementType} 등록하시겠습니까?`,
          {
            title: "입출고 등록 확인",
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.OK,
            onClose: (sAction) => {
              if (sAction === MessageBox.Action.OK) {
                this._saveMovement(oFormData);
              }
            }
          }
        );
      },

      _saveMovement(oFormData) {
        const oModel = this.getOwnerComponent().getModel("inventory");
        const oQuantityInput = this.byId("movementRegisterQuantity");
        const oNoteInput = this.byId("movementRegisterNote");
        const { oProductContext, oProduct, iQuantity, oDate, sType, sReason } = oFormData;
        const iBeforeStock = oProduct.stock;
        const iAfterStock = sType === "IN"
          ? iBeforeStock + iQuantity
          : iBeforeStock - iQuantity;
        const aMovements = oModel.getProperty("/movements") || [];
        const iNextMovementNumber = aMovements.reduce((iMax, oMovement) => {
          const iMovementNumber = Number(String(oMovement.movementId).replace("M", ""));
          return Number.isNaN(iMovementNumber) ? iMax : Math.max(iMax, iMovementNumber);
        }, 0) + 1;

        oModel.setProperty(`${oProductContext.getPath()}/stock`, iAfterStock);
        aMovements.push({
          movementId: `M${String(iNextMovementNumber).padStart(3, "0")}`,
          productId: oProduct.productId,
          date: this._formatFilterDate(oDate),
          type: sType,
          reason: sReason,
          quantity: iQuantity,
          beforeStock: iBeforeStock,
          afterStock: iAfterStock,
          note: oNoteInput.getValue().trim()
        });
        oModel.setProperty("/movements", aMovements);
        this._sortMovements();
        this._updateRegisterStock();
        oQuantityInput.setValue("");
        oNoteInput.setValue("");
        MessageToast.show(`${sType === "IN" ? "입고" : "출고"} 등록이 완료되었습니다.`);
      },

      _updateRegisterButton() {
        const oButton = this.byId("movementRegisterButton");
        const sType = this.byId("movementRegisterType").getSelectedKey();
        if (oButton) {
          oButton.setText(sType === "OUT" ? "출고 등록하기" : "입고 등록하기");
        }
      },

      _getRegisterFormData() {
        const oDateInput = this.byId("movementRegisterDate");
        const oProductInput = this.byId("movementRegisterProduct");
        const oQuantityInput = this.byId("movementRegisterQuantity");
        const oSelectedProduct = oProductInput.getSelectedItem();
        const oProductContext = oSelectedProduct &&
          oSelectedProduct.getBindingContext("inventory");
        const oProduct = oProductContext && oProductContext.getObject();
        const iQuantity = Number(oQuantityInput.getValue());
        const oDate = oDateInput.getDateValue();
        const sType = this.byId("movementRegisterType").getSelectedKey();
        const sReason = this.byId("movementRegisterReason").getSelectedKey();

        oQuantityInput.setValueState("None");
        oDateInput.setValueState("None");
        oProductInput.setValueState("None");

        if (!oDate) {
          oDateInput.setValueState("Error");
          MessageToast.show("처리 일자를 선택하세요.");
          return null;
        }
        if (!oProduct) {
          oProductInput.setValueState("Error");
          MessageToast.show("상품을 선택하세요.");
          return null;
        }
        if (!Number.isInteger(iQuantity) || iQuantity <= 0) {
          oQuantityInput.setValueState("Error");
          MessageToast.show("처리 수량은 1 이상의 정수로 입력하세요.");
          return null;
        }
        if (sType === "OUT" && iQuantity > oProduct.stock) {
          oQuantityInput.setValueState("Error");
          MessageToast.show("현재 재고보다 많은 수량을 출고할 수 없습니다.");
          return null;
        }
        return { oProductContext, oProduct, iQuantity, oDate, sType, sReason };
      },

      _updateRegisterStock() {
        const oProductInput = this.byId("movementRegisterProduct");
        const oStatus = this.byId("movementRegisterCurrentStock");
        if (!oProductInput || !oStatus) {
          return;
        }
        const oSelectedItem = oProductInput.getSelectedItem();
        if (!oSelectedItem) {
          oStatus.setText("상품을 선택하세요");
          oStatus.setState("Information");
          return;
        }
        const oContext = oSelectedItem.getBindingContext("inventory");
        const oProduct = oContext && oContext.getObject();
        if (!oProduct) {
          oStatus.setText("상품을 선택하세요");
          oStatus.setState("Information");
          return;
        }
        oStatus.setText(`현재 재고 ${oProduct.stock}개 · 안전 재고 ${oProduct.safetyStock}개`);
        oStatus.setState(oProduct.stock <= oProduct.safetyStock ? "Warning" : "Success");
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