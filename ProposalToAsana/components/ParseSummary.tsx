import type { ParsedPlanSummary } from "@/types/parser";

type ParseSummaryProps = {
  summary: ParsedPlanSummary;
};

export function ParseSummary({ summary }: ParseSummaryProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>파싱 결과 요약</h2>
      </div>
      <div className="panel-body">
        <div className="summary-grid">
          <SummaryItem label="상품코드" value={summary.productCodeDetected ? summary.productCode : `${summary.productCode} (임시)`} />
          <SummaryItem label="이벤트명" value={summary.eventTitle || "(PDF 첫 줄 기준)"} />
          <SummaryItem label="이벤트 구분" value={summary.eventLabels.join(", ")} />
          <SummaryItem label="응모 마감일" value={summary.deadlineIso || `찾지 못함, 기본 폴백 적용`} />
          <SummaryItem label="스토리 수" value={`${summary.storyCount}종`} />
          <SummaryItem label="VMD 생성 여부" value={summary.createVmdTask ? "생성" : "미생성"} />
          <SummaryItem label="당첨자 선정 태스크" value={summary.createWinnerAnnouncementTask ? "생성" : "미생성"} />
          <SummaryItem label="SNS 항목" value={summary.snsItems.join(", ")} />
          <SummaryItem label="섹션명" value={summary.sectionName} />
        </div>

        <div className="summary-list">
          <ItemList title={`포토카드 목록 (${summary.photocards.length}세트 / 총 ${summary.photocardTotal}종)`} items={summary.photocards} />
          <ItemList title={`특전 목록 (${summary.benefits.length}종 / 총 ${summary.benefitTotal}종)`} items={summary.benefits} />
        </div>

        <div className="due-text">{summary.dueSummary.text}</div>
        {!summary.productCodeDetected ? (
          <div className="notice">PDF에서 상품코드를 찾지 못해 임시 코드로 태스크 초안을 만들었습니다. 왼쪽의 상품코드 일괄 변경으로 실제 코드를 반영하세요.</div>
        ) : null}
      </div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ItemList({ title, items }: { title: string; items: Array<{ name: string; count: number }> }) {
  return (
    <div className="list-box">
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={`${item.name}-${item.count}`}>
              {item.name} ({item.count}종)
            </li>
          ))}
        </ul>
      ) : (
        <p>감지된 항목이 없습니다.</p>
      )}
    </div>
  );
}
