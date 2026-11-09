/*
 * 읽는 순서: onInit → _refreshMonthlyData → _calculateMonthlyData
 *
 * inventory 모델: Component에서 제공하는 mockData.json 기반 공통 입출고 원본
 * monthly 모델: 최근 6개월 입고·출고 합계를 차트에 제공하는 화면 전용 모델
 * 이름 앞의 _는 이 Controller 내부에서 사용하는 함수·변수라는 표시다.
 */
sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], (BaseController, JSONModel) => {
  "use strict";

  return BaseController.extend("icestock.inventory.icestock.inventory.controller.dashboard.MonthlyChart", {
    // 차트용 모델을 준비하고 공통 입출고 데이터의 로딩·변경을 감시한다.
    onInit() {
      this.getView().setModel(new JSONModel({ rows: [] }), "monthly");
      this._inventory = this.getOwnerComponent().getModel("inventory");
      this._inventory.attachRequestCompleted(this._refreshMonthlyData, this);
      this._movementBinding = this._inventory.bindList("/movements");
      this._movementBinding.attachChange(this._refreshMonthlyData, this);
      this._refreshMonthlyData();
    },

    // 공통 모델의 입출고 원본을 차트에 필요한 월별 합계로 변환한다.
    _refreshMonthlyData() {
      const aRows = this._calculateMonthlyData(new Date());
      this.getView().getModel("monthly").setProperty("/rows", aRows);
    },

    // 현재 월을 포함한 최근 6개월을 만들고 입고·출고 수량을 각각 합산한다.
    _calculateMonthlyData(oToday) {
      const aMovements = this._inventory.getProperty("/movements") || [];
      const aRows = [];
      const oStartMonth = new Date(oToday.getFullYear(), oToday.getMonth() - 5, 1);

      for (let i = 0; i < 6; i += 1) {
        const oMonth = new Date(
          oStartMonth.getFullYear(),
          oStartMonth.getMonth() + i,
          1
        );
        const sMonthKey = this._formatMonthKey(oMonth);
        let iInQuantity = 0;
        let iOutQuantity = 0;

        aMovements.forEach((oMovement) => {
          if (!oMovement.date || !oMovement.date.startsWith(sMonthKey)) {
            return;
          }
          if (oMovement.type === "IN") {
            iInQuantity += Number(oMovement.quantity) || 0;
          } else if (oMovement.type === "OUT") {
            iOutQuantity += Number(oMovement.quantity) || 0;
          }
        });

        aRows.push({
          month: `${oMonth.getMonth() + 1}월`,
          inQty: iInQuantity,
          outQty: iOutQuantity
        });
      }
      return aRows;
    },

    // 월별 집계에 사용하는 YYYY-MM 문자열을 만든다.
    _formatMonthKey(oDate) {
      return `${oDate.getFullYear()}-${String(oDate.getMonth() + 1).padStart(2, "0")}`;
    },

    // View 종료 시 공통 모델에 등록한 이벤트와 바인딩을 정리한다.
    onExit() {
      this._inventory.detachRequestCompleted(this._refreshMonthlyData, this);
      this._movementBinding.detachChange(this._refreshMonthlyData, this);
      this._movementBinding.destroy();
    }
  });
});