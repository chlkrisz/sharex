(async () => {
  const uploadedFilesSpan = document.querySelector("span#counter");
  const sizeSpan = document.querySelector("span#size");
  const uploadedFiles = await fetch(`/api/counter`);
  const raw = await uploadedFiles.json();
  uploadedFilesSpan.innerText = raw.count;
  sizeSpan.innerText = raw.size / 1000000; // Bytes to Megabytes

  if (raw.count == 1) document.querySelector("span#s").style.display = "none"; // Don't ask why, I don't know either!

  if (raw.count == 0)
    document.querySelector("p").innerHTML = "Failed to load uploads!";
})();
