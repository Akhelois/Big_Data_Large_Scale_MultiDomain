import "../styles/components/SectionHeader.css";

function SectionHeader({
  title,
  description
}) {
  return (
    <div className="section-header">
      <h2>
        {title}
      </h2>

      {description && (
        <p>
          {description}
        </p>
      )}
    </div>
  );
}

export default SectionHeader;