(async()=>{
    const uploadedFilesSpan = document.querySelector("span#counter");
    const uploadedFiles = await fetch(`/api/counter`);
    const raw = await uploadedFiles.json()
    uploadedFilesSpan.innerText = raw.count;
})()