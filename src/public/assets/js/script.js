(async()=>{
    const uploadedFilesSpan = document.querySelector("span#counter");
    const uploadedFiles = await fetch(`/api/counter`);
    const raw = await uploadedFiles.json()
    uploadedFilesSpan.innerText = raw.count;

    if(raw.count==1) document.querySelector("span#s").style.display = "none"; // Don't ask why, I don't know either!

    if(raw.counter == 0) document.querySelector("p").innerHTML = "Failed to load uploads!";
})()