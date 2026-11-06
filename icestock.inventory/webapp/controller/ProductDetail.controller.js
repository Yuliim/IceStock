/*
 * 상세 화면 흐름: URL의 productId 수신 → 원본 상품 찾기 → 상품별 집계 → detail 모델 표시
 * 원본은 읽기만 하며 표시용 계산 결과는 이 화면의 JSONModel에 담는다.
 */
sap.ui.define([
  "sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel"
], (Controller, JSONModel) => {
  "use strict";

  return Controller.extend("icestock.inventory.icestock.inventory.controller.ProductDetail", {
    // 화면용 모델과 두 이벤트(원본 로딩 완료, 상세 라우트 진입)를 준비한다.
    onInit() {
      // found=false일 때 View는 상세 본문 대신 안내 메시지를 보여 준다.
      this.getView().setModel(new JSONModel({ found: false, message: "상품 정보를 불러오는 중입니다." }), "detail");
      this._inventory = this.getOwnerComponent().getModel("inventory");
      // 상세 URL 직접 진입 시 원본 로딩이 늦을 수 있어 완료 후 다시 조회한다.
      this._inventory.attachRequestCompleted(this._loadProduct, this);
      this._route = this.getOwnerComponent().getRouter().getRoute("productDetail");
      this._route.attachPatternMatched(this._onMatched, this);
    },

    // product/{productId}로 진입할 때마다 실행된다. 다른 상품 이동 시에도 다시 조회한다.
    _onMatched(event) {
      try {
        // 목록에서 인코딩한 코드를 원래 값으로 복원한다.
        this._productId = decodeURIComponent(event.getParameter("arguments").productId);
      } catch {
        // 잘못 인코딩된 URL도 화면을 중단하지 않고 '상품 없음'으로 처리한다.
        this._productId = "";
      }
      this._loadProduct();
    },

    // 선택 상품만 골라 상세 표시용 값을 계산한다.
    _loadProduct() {
      const products = this._inventory.getProperty("/products");
      const model = this.getView().getModel("detail");
      // 아직 로딩되지 않은 상태와 로딩 후 상품이 없는 상태를 구분한다.
      if (!products) {
        model.setData({ found: false, message: "상품 데이터를 불러오는 중입니다. 연결 실패 시 새로고침해 주세요." });
        return;
      }
      const product = products.find((item) => item.productId === this._productId);
      if (!product) {
        model.setData({ found: false, message: "해당 상품을 찾을 수 없습니다. 상품 목록에서 다시 선택해 주세요." });
        return;
      }
      // categoryId로 이름을 찾고 판매 내역도 이 상품의 데이터만 선택한다.
      const categories = this._inventory.getProperty("/categories") || [];
      const category = categories.find((item) => item.categoryId === product.categoryId);
      const sales = (this._inventory.getProperty("/sales") || []).filter((sale) => sale.productId === product.productId);
      // 상품별 누적 판매 요약을 상세 화면 전용 모델에 담는다.
      let soldQuantity = 0;
      let revenue = 0;
      let cost = 0;
      let profit = 0;
      sales.forEach((sale) => {
        soldQuantity += sale.quantity;
        revenue += sale.totalAmount;
        cost += sale.totalCost;
        profit += sale.profit;
      });
      // filter: 상품 이력 선택 → map: 표시 문구 추가 → sort: 최신순 정렬
      // 복사한 객체만 가공하므로 공통 movements 데이터는 변경되지 않는다.
      const history = (this._inventory.getProperty("/movements") || [])
        .filter((movement) => movement.productId === product.productId)
        .map((movement) => ({
          ...movement,
          typeLabel: movement.type === "IN" ? "입고" : "출고",
          typeState: movement.type === "IN" ? "Success" : "Error",
          reasonLabel: { PURCHASE: "매입", SALE: "판매", DISCARD: "폐기" }[movement.reason] || movement.reason,
          signedQuantity: (movement.type === "IN" ? "+" : "−") + movement.quantity,
          note: movement.note || "-"
        }))
        // YYYY-MM-DD는 문자열로 날짜순 비교가 가능하다. 같은 날짜는 처리번호 역순이다.
        .sort((left, right) => right.date.localeCompare(left.date) ||
          right.movementId.localeCompare(left.movementId, undefined, { numeric: true }));
      const low = product.stock <= product.safetyStock;
      // 100건이 넘는 이력도 바인딩되도록 기본 목록 제한을 늘린다.
      model.setSizeLimit(Math.max(history.length, 100));
      // detail> 경로에 연결된 View 컨트롤들이 아래 값을 표시한다.
      model.setData({
        found: true, product,
        categoryName: category ? category.categoryName : product.categoryId,
        stockStatus: low ? "재고 부족" : "재고 정상",
        stockState: low ? "Error" : "Success",
        requiredQuantity: Math.max(product.safetyStock - product.stock, 0),
        stockValue: product.stock * product.purchasePrice,
        // 안전재고·매출이 0이면 나눗셈 결과가 Infinity/NaN이 되지 않도록 분기한다.
        stockRate: product.safetyStock > 0 ? Math.round(product.stock / product.safetyStock * 100) + "%" : "기준 없음",
        soldQuantity, revenue, cost, profit,
        margin: revenue > 0 ? (profit / revenue * 100).toFixed(1) + "%" : "0.0%",
        history
      });
    },

    // View의 formatter에서 호출한다. 숫자를 '1,000원' 형태로 표시한다.
    formatWon(value) {
      return value === undefined || value === null ? "" : Number(value).toLocaleString("ko-KR") + "원";
    },

    // 방문 이력에 의존하지 않아 상세 URL 직접 진입 후에도 목록으로 돌아간다.
    onBack() {
      this.getOwnerComponent().getRouter().navTo("product");
    },

    // 등록한 이벤트를 같은 함수·this 조합으로 해제한다.
    onExit() {
      this._inventory.detachRequestCompleted(this._loadProduct, this);
      this._route.detachPatternMatched(this._onMatched, this);
    }
  });
});
