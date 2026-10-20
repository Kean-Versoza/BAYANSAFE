/**
 * The full screen loader. It is painted by the useSkeleton hook, which
 * measures the real layout and fills this box with grey blocks.
 */
export default function PageSkeleton({ containerRef, visible }) {
  return (
    <div
      id="pageSkeleton"
      className={`page-skeleton${visible ? ' is-active' : ''}`}
      ref={containerRef}
      aria-hidden="true"
    />
  );
}
