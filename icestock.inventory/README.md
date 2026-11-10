# 🍦 ICE STOCK

**아이스크림 매장의 상품·재고·입출고·판매 현황을 관리하는 SAPUI5 웹 애플리케이션**입니다.

상품을 등록하고 입고·판매를 처리하면 변경된 재고와 판매 실적을 대시보드에서 확인할 수 있습니다. 5명이 기능별로 역할을 나누어 SAPUI5의 XML View, Controller, JSONModel, 데이터 바인딩과 화면 간 연동을 학습한 팀 프로젝트입니다.

## 주요 기능

### Dashboard — 매장 현황

- **KPI 4개:** 활성 상품 수, 총 재고 수량, 재고 부족 상품 수, 이번 달 입출고 처리 건수
- **월별 입출고 차트:** 당월을 포함한 최근 6개월의 입고·출고 수량 비교
- **카테고리별 재고 차트:** 카테고리별 현재 재고 합계와 비중 확인
- **재고 부족 상품 목록:** 보충이 필요한 상품 조회 및 상품 관리 화면 연결
- **누적 인기 상품 TOP 5:** 상품별 누적 판매수량으로 순위 표시
- 상품·입출고 변경 알림을 받아 관련 집계 갱신

### Product — 상품 관리

- 상품 등록 및 상품코드 자동 부여
- 상품명·카테고리·안전재고 수정
- 상품코드·상품명 검색, 카테고리·재고 상태 필터, 판매량 등 기준별 정렬
- **판매 중 / 판매 중지 / 전체 상품** 필터
- 상품 비활성화·재활성화 및 기존 판매·입출고 이력 보존
- 상품 상세에서 재고, 보충 필요수량, 판매수량, 매출·원가·매출총이익·마진율, 입출고 이력 조회

### Stock Movement — 입출고 관리

- 처리 일자·상품·유형·수량·사유를 입력하여 입출고 등록
- 처리 전후 재고 및 입출고 이력 기록
- 필수 입력과 양의 정수 수량 검증, 현재 재고를 초과하는 출고 차단
- **출고 + 판매** 처리 시 판매 내역과 매출·원가·이익 기록
- 매입 입고·폐기 출고를 판매 실적과 구분
- 상품 검색, 날짜·유형·사유 필터 및 이력 정렬

## 기술 구성

| 구분 | 사용 기술 |
| --- | --- |
| 프런트엔드 | SAPUI5, JavaScript, XML View, CSS |
| 데이터 | SAPUI5 JSONModel, JSON 모의 데이터 |
| 화면 이동 | SAPUI5 Router, manifest.json |
| 화면 간 갱신 | Component EventBus 및 모델 변경 감지 |
| 차트 | SAP VizFrame |
| 테마 | SAP Horizon |
| 개발 도구 | SAP Fiori Tools, UI5 CLI, npm, ESLint |
| 테스트 | Node.js Test Runner, QUnit·OPA5 기본 구조 |

앱 ID 및 실제 리소스 네임스페이스는 `icestock.inventory.icestock.inventory`입니다. UI5 최소 버전과 로컬 프레임워크 설정은 `1.120.53`을 기준으로 합니다.

## 실행 방법

Node.js와 npm이 설치된 환경에서 진행합니다. 개발에 사용한 Node.js는 24 계열입니다.

저장소 루트에서 앱 폴더로 이동한 뒤 의존성을 설치하고 실행합니다.

```powershell
cd icestock.inventory
npm ci
npm start
```

이미 앱 폴더 안에 있다면 `cd` 단계는 생략합니다. `npm start`는 Fiori Launchpad 미리보기로 앱을 실행합니다. UI5 리소스 다운로드·프록시 사용을 위해 네트워크 연결이 필요할 수 있습니다.

| 명령 | 설명 |
| --- | --- |
| `npm start` | Fiori Launchpad 미리보기 실행 |
| `npm run start-noflp` | index.html로 앱 직접 실행 |
| `npm run start-local` | ui5-local.yaml의 SAPUI5 프레임워크 설정으로 실행 |
| `npm run build` | dist/에 빌드 결과 생성 |
| `npm run lint` | ESLint 검사 |

## 기본 사용 흐름

1. **Product**에서 상품명·카테고리·안전재고·단가를 입력해 상품을 등록합니다. 새 상품의 재고는 0개입니다.
2. **Stock Movement**에서 해당 상품을 선택하고 입고·매입을 등록합니다.
3. 판매가 발생하면 **출고 / 판매**로 등록합니다. 재고가 줄고 판매 내역이 추가됩니다.
4. **Dashboard**에서 재고 지표·차트·부족 목록·누적 인기 순위의 변화를 확인합니다.
5. 상품명을 눌러 상세 정보를 조회합니다. 판매를 중단한 상품은 비활성화하고, 판매 상태 필터로 조회하거나 다시 활성화할 수 있습니다.

예를 들어 60개를 입고한 뒤 58개를 판매하면 현재 재고는 2개, 해당 상품의 판매수량은 58개가 됩니다. 안전재고가 5개라면 재고 보충 대상임을 확인할 수 있습니다.

## 프로젝트 구조

```text
icestock.inventory/
├─ webapp/
│  ├─ index.html                  # 앱 진입점
│  ├─ Component.js                # 공통 모델 생성·Router 초기화
│  ├─ manifest.json               # 앱 정보·라이브러리·라우팅
│  ├─ controller/                 # 상품·상세·입출고·공통 화면 처리
│  │  └─ dashboard/               # KPI·차트·테이블별 집계 및 이벤트 처리
│  ├─ view/                       # XML 화면
│  │  ├─ dashboard/               # 대시보드 하위 화면
│  │  └─ fragment/                # 상품 등록·수정 Dialog
│  ├─ model/                      # 모델 생성 코드·mockData.json
│  ├─ css/                        # 스타일
│  ├─ i18n/                       # 화면 문구 리소스
│  └─ test/                       # QUnit·OPA5 기본 테스트 구조
├─ test/                          # Controller 자동 테스트
├─ package.json                   # 의존성·실행 명령
├─ package-lock.json              # 의존성 버전 고정
├─ ui5.yaml                       # 기본 개발 서버·빌드 설정
├─ ui5-local.yaml                 # 로컬 SAPUI5 프레임워크 설정
└─ eslint.config.mjs              # 코드 검사 설정
```

`figma-make-source/`는 화면 구성 참고용 소스이며 실행 앱은 `webapp/`입니다. 개발 계획·테스트 결과·발표 시나리오는 로컬 `mds/`에서 관리합니다. 두 폴더 모두 현재 Git 제외 대상이므로 새로 저장소를 내려받은 환경에는 없을 수 있습니다.

## 데이터와 집계 방식

공통 `inventory` 모델에서 다음 데이터를 관리합니다.

| 데이터 | 내용 |
| --- | --- |
| products | 상품 기본정보, 현재 재고, 안전재고, 판매 상태 |
| categories | 카테고리 코드와 이름 |
| movements | 입출고 유형·사유·수량·처리 전후 재고 |
| sales | 판매수량, 매출액, 원가, 이익 |

각 화면은 원본 데이터를 읽어 화면용 JSONModel로 가공합니다. 상품·입출고 저장 후 `inventory / changed` 이벤트를 발행하고, 카테고리 차트·TOP 5 등은 이 알림을 받아 재계산합니다.

- 이번 달 **처리 건수**는 입출고 이력 수, 입고·출고 **수량**은 quantity 합계입니다.
- 누적 인기 순위는 sales의 상품별 판매수량 합계입니다. 단순 재고 수정이나 폐기 출고는 판매량을 늘리지 않습니다.
- 원가와 매출총이익은 기록된 매입·매출단가 기준이며 별도 운영비 등을 포함하지 않습니다.

현재는 별도 백엔드·DB 없이 `mockData.json`을 사용하는 프런트엔드 프로젝트입니다. 등록·수정한 내용은 현재 실행 중인 앱의 메모리에 반영되며, **새로고침하면 초기 데이터로 돌아갑니다.**

## 테스트

앱 폴더에서 다음 명령으로 Controller 자동 테스트를 실행합니다.

```powershell
node --test test/product-controllers.test.cjs test/kpi-controller.test.cjs test/dashboard-refresh.test.cjs
```

상품 데이터 가공·저장, KPI 계산, 변경 이벤트 처리, 판매 출고 후 TOP 5 갱신 등을 검증합니다. 이 테스트는 모델·컨트롤 대역을 사용하므로 실제 UI5 화면 렌더링이나 브라우저 조작 검증과 구분합니다.

## 팀 역할

| 담당 | 주요 구현 영역 |
| --- | --- |
| A · 유림 | Product·Product Detail, 상품 CRUD·검색·필터, 공통 화면·라우팅 |
| B · 명진 | Stock Movement, 입출고·재고 검증, 공통 데이터 기반 |
| C · 지호 | Dashboard KPI 4개 |
| D · 혜린 | 월별 입출고 차트, 재고 부족 상품 목록 |
| E · 혜림 | 카테고리별 재고 차트, 누적 인기 상품 TOP 5 |

각 담당 화면을 View·Controller로 분리하고, 공통 데이터와 변경 이벤트를 통해 하나의 앱으로 연결했습니다.

## 프로젝트 시작 기반

SAP Fiori Application Generator의 Basic 템플릿으로 생성했습니다.

- 생성일: 2026-11-05
- 생성 도구 버전: 1.33.0
- 개발 환경: Visual Studio Code
- 앱 버전: 0.0.1
