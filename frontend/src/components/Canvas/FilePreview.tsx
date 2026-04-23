interface Props {
  fileUrl: string
  fileType: string
  fileName: string
}

export default function FilePreview({ fileUrl, fileType, fileName }: Props) {
  if (fileType === 'image') {
    return (
      <img
        src={fileUrl}
        alt={fileName}
        className="max-w-full max-h-full object-contain rounded"
      />
    )
  }

  if (fileType === 'pdf') {
    return (
      <iframe
        src={fileUrl}
        title={fileName}
        className="w-full h-full border-0 rounded bg-bg-surface"
      />
    )
  }

  if (fileType === 'excel') {
    return (
      <div className="text-text-muted text-sm p-4">
        <p>Excel 文件: {fileName}</p>
        <p className="text-xs mt-1">内容将在对话时自动提取为文本</p>
      </div>
    )
  }

  return (
    <div className="text-text-muted text-sm p-4">
      未知文件类型: {fileName}
    </div>
  )
}
