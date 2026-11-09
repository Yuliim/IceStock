/*
 * 읽는 순서: onInit → _sortMovements → _applyFilters
 * 등록 흐름: onRegisterMovement → _getRegisterFormData → _saveMovement
 *
 * inventory 모델: Component에서 제공하는 공통 상품·입출고 원본 데이터
 * 화면의 입력 컨트롤: 등록 폼과 검색 조건을 직접 관리한다.
 * rows 바인딩: inventory>/movements를 필터·정렬하여 이력 테이블에 표시한다.
 * 이름 앞의 _는 이 Controller 내부에서 사용하는 함수·변수라는 표시다.
 */
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
      // 화면 초기화 시 데이터 정렬, 기본 처리일자, 등록 버튼 상태를 준비한다.
      onInit() {
        const oInventoryModel = this.getOwnerComponent().getModel("inventory");
        // 비동기 JSON 로딩이 끝난 뒤에도 최신 입출고 순서를 다시 적용한다.
        oInventoryModel.attachRequestCompleted(() => {
          this._sortMovements();
        });
        this._sortMovements();
        this.byId("movementRegisterDate").setDateValue(new Date());
        this._updateRegisterButton();
      },

      // 검색 필터나 정렬 조건이 바뀌면 테이블 바인딩에 다시 적용한다.
      onFilterChange() {
        this._applyFilters();
      },

      // 검색 화면의 입력값을 초기 상태로 되돌린 뒤 필터를 다시 적용한다.
      onResetFilters() {
        this.byId("movementSearchField").setValue("");
        this.byId("movementStartDate").setDateValue(null);
        this.byId("movementEndDate").setDateValue(null);
        this.byId("movementTypeSelect").setSelectedKey("ALL");
        this.byId("movementReasonSelect").setSelectedKey("ALL");
        this.byId("movementSortSelect").setSelectedKey("LATEST");
        this._applyFilters();
      },

      // 입고·출고 유형에 따라 등록 버튼 문구와 현재 재고 표시를 갱신한다.
      onRegisterTypeChange() {
        this._updateRegisterButton();
        this._updateRegisterStock();
      },

      // 상품 선택 변경 시 선택 상태를 확인하고 현재 재고를 표시한다.
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

      // 입력값을 검증한 뒤 사용자 확인을 거쳐 입출고를 저장한다.
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

      // 재고·입출고 이력을 저장하고, 판매 출고라면 판매 내역까지 함께 기록한다.
      _saveMovement(oFormData) {
        const oModel = this.getOwnerComponent().getModel("inventory");
        const oQuantityInput = this.byId("movementRegisterQuantity");
        const oNoteInput = this.byId("movementRegisterNote");
        const { oProductContext, oProduct, iQuantity, oDate, sType, sReason } = oFormData;
        // 처리 전 재고에서 입고는 더하고 출고는 빼서 처리 후 재고를 계산한다.
        const iBeforeStock = oProduct.stock;
        const iAfterStock = sType === "IN"
          ? iBeforeStock + iQuantity
          : iBeforeStock - iQuantity;
        const aMovements = oModel.getProperty("/movements") || [];
        // 기존 처리번호 중 가장 큰 숫자를 찾아 다음 번호를 만든다.
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

        // TOP 5와 상품 상세는 /sales를 기준으로 판매수량·매출을 계산한다.
        // 재고만 줄이면 판매량은 늘지 않으므로 OUT + SALE일 때 판매 내역도 추가한다.
        // 매입 입고나 폐기 출고는 판매가 아니므로 이 배열에 추가하지 않는다.
        if (sType === "OUT" && sReason === "SALE") {
          const aSales = oModel.getProperty("/sales") || [];
          const iNextSalesNumber = aSales.reduce((iMax, oSale) => {
            const aMatch = /^S(\d+)$/.exec(oSale.salesId || "");
            return aMatch ? Math.max(iMax, Number(aMatch[1])) : iMax;
          }, 0) + 1;
          const iTotalAmount = iQuantity * oProduct.sellingPrice;
          const iTotalCost = iQuantity * oProduct.purchasePrice;

          oModel.setProperty("/sales", [...aSales, {
            salesId: `S${String(iNextSalesNumber).padStart(3, "0")}`,
            productId: oProduct.productId,
            date: this._formatFilterDate(oDate),
            quantity: iQuantity,
            totalAmount: iTotalAmount,
            totalCost: iTotalCost,
            profit: iTotalAmount - iTotalCost
          }]);
        }

        this._sortMovements();
        // 판매 내역까지 저장한 뒤 알림을 보내야 TOP 5가 최신 판매량을 집계한다.
        this.getOwnerComponent().getEventBus().publish("inventory", "changed");
        this._updateRegisterStock();
        oQuantityInput.setValue("");
        oNoteInput.setValue("");
        MessageToast.show(`${sType === "IN" ? "입고" : "출고"} 등록이 완료되었습니다.`);
      },

      // 입고·출고 유형에 맞는 등록 버튼 문구를 설정한다.
      _updateRegisterButton() {
        const oButton = this.byId("movementRegisterButton");
        const sType = this.byId("movementRegisterType").getSelectedKey();
        if (oButton) {
          oButton.setText(sType === "OUT" ? "출고 등록하기" : "입고 등록하기");
        }
      },

      // 등록 폼의 값을 읽고 필수값, 수량, 출고 가능 재고를 검증한다.
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

      // 선택한 상품의 현재 재고와 안전 재고를 상태 색상과 함께 표시한다.
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

      // 검색어·기간·유형·사유를 조합해 이력 테이블의 애플리케이션 필터를 구성한다.
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

        // 상품코드 또는 상품명에 검색어가 포함된 이력만 남긴다.
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

        // 날짜는 YYYY-MM-DD 문자열로 비교하므로 시작일과 종료일을 포함한다.
        if (oStartDate || oEndDate) {
          const sStartDate = oStartDate ? this._formatFilterDate(oStartDate) : "0000-01-01";
          const sEndDate = oEndDate ? this._formatFilterDate(oEndDate) : "9999-12-31";
          aFilters.push(new Filter({
            path: "date",
            test: (sDate) => sDate >= sStartDate && sDate <= sEndDate
          }));
        }

        // 전체 유형·사유가 아니면 선택한 값과 같은 데이터만 필터링한다.
        const sType = this.byId("movementTypeSelect").getSelectedKey();
        if (sType !== "ALL") {
          aFilters.push(new Filter("type", FilterOperator.EQ, sType));
        }

        const sReason = this.byId("movementReasonSelect").getSelectedKey();
        if (sReason !== "ALL") {
          aFilters.push(new Filter("reason", FilterOperator.EQ, sReason));
        }

        // 여러 필터는 AND 조건으로 적용하고, 선택한 정렬과 결과 건수도 갱신한다.
        oBinding.filter(aFilters, FilterType.Application);
        this._applySort(oBinding);
        this.byId("movementCount").setText(`(${oBinding.getLength()}건)`);
      },

      // 선택한 정렬 기준을 테이블 바인딩에 적용한다.
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

      // DatePicker 값을 필터와 저장에 사용하는 YYYY-MM-DD 형식으로 변환한다.
      _formatFilterDate(oDate) {
        const iMonth = String(oDate.getMonth() + 1).padStart(2, "0");
        const iDay = String(oDate.getDate()).padStart(2, "0");
        return `${oDate.getFullYear()}-${iMonth}-${iDay}`;
      },

      // 모델의 입출고 원본 배열을 최신 처리일자와 처리번호 순으로 정렬한다.
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

      // 상품코드를 상품명과 함께 표시할 문자열로 변환한다.
      formatProductLabel(sProductId, aProducts) {
        const oProduct = (aProducts || []).find((oItem) => oItem.productId === sProductId);
        return `${oProduct ? oProduct.productName : sProductId}(${sProductId})`;
      },

      // 입출고 코드와 화면 표시용 한글 문구를 변환한다.
      formatType(sType) {
        return sType === "IN" ? "입고" : "출고";
      },

      // 입고는 성공, 출고는 오류 색상으로 표시한다.
      formatTypeState(sType) {
        return sType === "IN" ? "Success" : "Error";
      },

      // 처리 사유 코드를 화면 표시용 한글 문구로 변환한다.
      formatReason(sReason) {
        const mReasonLabels = {
          PURCHASE: "매입",
          SALE: "판매",
          DISCARD: "폐기"
        };
        return mReasonLabels[sReason] || sReason;
      },

      // 입고는 양수, 출고는 음수로 표시해 재고 변동 방향을 구분한다.
      formatQuantity(sType, iQuantity) {
        if (iQuantity === undefined || iQuantity === null) {
          return "";
        }
        return `${sType === "IN" ? "+" : "-"}${iQuantity}개`;
      }
  });
});
