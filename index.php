<?php
error_reporting(0); // Hide warnings on production, comment out for debugging

function normalize($name) {
    // Remove extension
    $name = preg_replace('/\.[^.\/]+$/', '', $name);
    // Replace numbers, underscores, hyphens with space
    $name = preg_replace('/[\d_\-]+/', ' ', $name);
    // Collapse multiple spaces
    $name = preg_replace('/\s+/', ' ', $name);
    return strtolower(trim($name));
}

function groupFiles($files) {
    $groups = [];
    if (empty($files)) {
        return $groups;
    }

    foreach ($files as $file) {
        $normalizedName = normalize($file['name']);
        if (empty($groups)) {
            $groups[$file['name']] = [$file];
            continue;
        }

        $bestMatchKey = '';
        $highestSimilarity = 0.0;

        foreach (array_keys($groups) as $groupKey) {
            similar_text(normalize($groupKey), $normalizedName, $similarity);
            if ($similarity > $highestSimilarity) {
                $highestSimilarity = $similarity;
                $bestMatchKey = $groupKey;
            }
        }

        if ($highestSimilarity > 60) { // Similarity threshold
            $groups[$bestMatchKey][] = $file;
        } else {
            $groups[$file['name']] = [$file];
        }
    }
    return $groups;
}

$results = null;
$error = null;

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    if (!empty($_POST['dirPath'])) {
        // --- Process Path Input ---
        $dirPath = $_POST['dirPath'];
        $fullPath = realpath($dirPath);

        if ($fullPath && is_dir($fullPath)) {
            $fileNames = array_diff(scandir($fullPath), ['.', '..']);
            $fileData = [];
            foreach ($fileNames as $fileName) {
                if (is_file($fullPath . '/' . $fileName)) {
                    $fileData[] = [
                        'name' => $fileName,
                        'path' => $dirPath . '/' . $fileName,
                        'type' => mime_content_type($fullPath . '/' . $fileName)
                    ];
                }
            }
        } else {
            $error = "Path not found or is not a directory: " . htmlspecialchars($dirPath);
        }

    } elseif (!empty($_POST['textList'])) {
        // --- Process Textarea Input ---
        $textList = $_POST['textList'];
        $fileNames = array_filter(array_map('trim', explode("\n", $textList)));
        $fileData = [];
        foreach ($fileNames as $fileName) {
            $fileData[] = [
                'name' => $fileName,
                'path' => 'pasted-list',
                'type' => 'text'
            ];
        }
    }

    if (!empty($fileData)) {
        $groupedFiles = groupFiles($fileData);
        $authenticityScores = [];
        foreach ($groupedFiles as $groupName => $filesInGroup) {
            if (count($filesInGroup) <= 1) {
                $authenticityScores[$groupName] = 100;
                continue;
            }
            $totalSimilarity = 0;
            foreach ($filesInGroup as $file) {
                similar_text(normalize($groupName), normalize($file['name']), $similarity);
                $totalSimilarity += $similarity;
            }
            $authenticityScores[$groupName] = round($totalSimilarity / count($filesInGroup));
        }
        
        $results = [
            'files' => $fileData,
            'groupedFiles' => $groupedFiles,
            'authenticityScores' => $authenticityScores
        ];
    } elseif (!$error) {
        // Handle case where form submitted but no data found
        // $error = "No files to process.";
    }
}
?>

    
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>File Name Manager (PHP Version)</title>
  <style>
    /* General Body Styles */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 1rem;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 1rem; }
    header { text-align: center; margin-bottom: 2rem; }
    header h1 { font-size: 2.25rem; font-weight: 700; color: #0f172a; }
    header p { color: #475569; margin-top: 0.5rem; }
    .upload-area { display: block; width: 100%; padding: 2rem; text-align: center; border: 2px dashed #e2e8f0; border-radius: 0.75rem; }
    .path-input-container { margin: 2rem 0; text-align: center; }
    .path-input-container p { color: #475569; margin-bottom: 0.75rem; }
    #path-form { display: flex; justify-content: center; gap: 0.5rem; }
    #path-input { border: 1px solid #cbd5e1; border-radius: 0.375rem; padding: 0.5rem 0.75rem; font-family: monospace; width: 280px; }
    #path-form button { background-color: #4f46e5; color: white; font-weight: 600; border: none; border-radius: 0.375rem; padding: 0.5rem 1rem; cursor: pointer; }
    .results-info { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; margin-top: 2rem; margin-bottom: 1.5rem; background-color: #dcfce7; color: #166534; border: 1px solid #bbf7d0; border-radius: 0.75rem; }
    .error-info { background-color: #fee2e2; color: #991b1b; border-color: #fecaca; }
    .file-group { padding: 1rem; margin-bottom: 1rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; }
    .file-group-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 0.5rem; margin-bottom: 0.5rem; border-bottom: 1px solid #e2e8f0; }
    .file-group-title { display: flex; align-items: center; gap: 0.5rem; }
    .file-group-title h3 { font-size: 1.125rem; font-weight: 600; }
    .file-group-authenticity { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
    .authenticity-dot { width: 0.75rem; height: 0.75rem; background-color: #fb923c; border-radius: 9999px; }
    .file-item { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; border-radius: 0.375rem; }
    .file-item:hover { background-color: #f1f5f9; }
    .file-item-name { display: flex; align-items: center; gap: 0.75rem; font-family: monospace; font-size: 0.875rem; }
    .file-item-info-btn { padding: 0.25rem; color: #94a3b8; background: none; border: none; cursor: pointer; }
    .modal-overlay { position: fixed; inset: 0; z-index: 50; display: none; align-items: center; justify-content: center; background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); }
    .modal-content { background-color: white; border-radius: 0.75rem; padding: 1.5rem; width: 100%; max-width: 500px; margin: 1rem; }
    .modal-header { display: flex; align-items: flex-start; justify-content: space-between; }
    .modal-header h3 { font-size: 1.25rem; font-weight: 600; }
    .modal-close-btn { padding: 0.25rem; color: #94a3b8; background: none; border: none; border-radius: 9999px; cursor: pointer; }
    .modal-body { margin-top: 1rem; font-size: 0.875rem; color: #334155; }
    .modal-body-row { display: flex; margin-bottom: 0.5rem; }
    .modal-body-row .label { width: 6rem; font-weight: 500; color: #64748b; }
    .modal-body-row .value { font-family: monospace; word-break: break-all; }
  </style>
</head>
<body>

  <div class="container">
    <header>
      <h1>File Name Manager (PHP Version)</h1>
      <p>Enter a server path to automatically group and analyze file names.</p>
    </header>

    <main>
       <div class="path-input-container">
        <form id="path-form" method="POST" action="index.php">
          <input 
            type="text" 
            id="path-input" 
            name="dirPath"
            placeholder="e.g., storage/series_A or ./Videos"
            value="<?= htmlspecialchars($_POST['dirPath'] ?? '') ?>"
            style="border: 1px solid #cbd5e1; border-radius: 0.375rem; padding: 0.5rem 0.75rem; font-family: monospace; width: 280px;"
          />
          <button type="submit" style="background-color: #4f46e5; color: white; font-weight: 600; border: none; border-radius: 0.375rem; padding: 0.5rem 1rem; cursor: pointer;">Process Path</button>
        </form>
      </div>

      <div class="path-input-container" style="margin: 2rem 0; text-align: center;">
        <p style="color: #475569; margin-bottom: 0.75rem;">Or paste a list of file names (one per line):</p>
        <form id="text-form" method="POST" action="index.php" style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
          <textarea 
            id="text-input" 
            name="textList"
            placeholder="file_a_01.mkv\nfile_a_02.mkv\nfile_b_01.mkv"
            style="border: 1px solid #cbd5e1; border-radius: 0.375rem; padding: 0.5rem 0.75rem; font-family: monospace; width: 100%; max-width: 450px; height: 120px;"
          ><?= htmlspecialchars($_POST['textList'] ?? '') ?></textarea>
          <button type="submit" style="background-color: #16a34a; color: white; font-weight: 600; border: none; border-radius: 0.375rem; padding: 0.5rem 1rem; cursor: pointer;">Process List</button>
        </form>
      </div>

      <div id="results-container">
        <?php if (isset($error)): ?>
            <div class="results-info error-info"><p><?= $error ?></p></div>
        <?php endif; ?>

        <?php if ($results): ?>
            <div class="results-info">
              <p><b><?= count($results['files']) ?> files</b> loaded successfully. Found <b><?= count($results['groupedFiles']) ?></b> potential groups.</p>
            </div>

            <?php foreach ($results['groupedFiles'] as $groupName => $filesInGroup): ?>
              <div class="file-group">
                <div class="file-group-header">
                  <div class="file-group-title"><h3><?= htmlspecialchars($groupName) ?></h3></div>
                  <div class="file-group-authenticity">
                    <div class="authenticity-dot"></div>
                    <span><?= $results['authenticityScores'][$groupName] ?>% Authentic</span>
                  </div>
                </div>
                <div class="file-list">
                  <?php foreach ($filesInGroup as $file): ?>
                    <div class="file-item">
                      <div class="file-item-name"><span><?= htmlspecialchars($file['name']) ?></span></div>
                      <button class="file-item-info-btn" 
                              data-name="<?= htmlspecialchars($file['name']) ?>" 
                              data-path="<?= htmlspecialchars($file['path']) ?>" 
                              data-type="<?= htmlspecialchars($file['type']) ?>">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                      </button>
                    </div>
                  <?php endforeach; ?>
                </div>
              </div>
            <?php endforeach; ?>
        <?php endif; ?>
      </div>
    </main>
  </div>

  <div class="modal-overlay" id="modal-overlay">
    <div class="modal-content">
      <div class="modal-header">
        <h3>File Details</h3>
        <button class="modal-close-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="modal-body-row"><span class="label">Name:</span><span class="value" id="modal-name"></span></div>
        <div class="modal-body-row"><span class="label">Path:</span><span class="value" id="modal-path"></span></div>
        <div class="modal-body-row"><span class="label">Type:</span><span class="value" id="modal-type"></span></div>
      </div>
    </div>
  </div>

  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const resultsContainer = document.getElementById('results-container');
      const modalOverlay = document.getElementById('modal-overlay');
      const modalName = document.getElementById('modal-name');
      const modalPath = document.getElementById('modal-path');
      const modalType = document.getElementById('modal-type');

      const showModal = (file) => {
        modalName.textContent = file.name;
        modalPath.textContent = file.path;
        modalType.textContent = file.type || 'N/A';
        modalOverlay.style.display = 'flex';
      };

      const closeModal = () => {
        modalOverlay.style.display = 'none';
      };

      resultsContainer.addEventListener('click', (event) => {
        const button = event.target.closest('.file-item-info-btn');
        if (button) {
          showModal(button.dataset);
        }
      });

      modalOverlay.addEventListener('click', closeModal);
      modalOverlay.querySelector('.modal-content').addEventListener('click', (e) => e.stopPropagation());
      modalOverlay.querySelector('.modal-close-btn').addEventListener('click', closeModal);
    });
  </script>

</body>
</html>
