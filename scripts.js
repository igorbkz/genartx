const HF_TOKEN = "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";

async function query(data) {
    const response = await fetch(
        "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
        {
            headers: {
                Authorization: `Bearer ${HF_TOKEN}`,
                "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify(data),
        }
    );
    if (!response.ok) {
        throw new Error('Erro na consulta ao modelo de geração de imagens');
    }
    const result = await response.blob();
    return result;
}

async function queryPromptEnhancement(userPrompt) {
    const response = await fetch(
        "https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct",
        {
            headers: {
                Authorization: `Bearer ${HF_TOKEN}`,
                "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({
                inputs: `Create a vivid and appealing image description based on this input: "${userPrompt}". Enhance the user's idea while staying true to their intent. Use 20-30 words to describe a visually striking scene. Focus on elements that would make an attractive image. Your entire response must be only the image description, without any additional text or explanations.`,
                parameters: {
                    max_new_tokens: 80,
                    return_full_text: false,
                    temperature: 0.7,
                    top_p: 0.9,
                },
            }),
        }
    );
    if (!response.ok) {
        throw new Error('Error querying the prompt enhancement model');
    }
    const result = await response.json();
    let enhancedPrompt = result[0]?.generated_text?.trim() || '';
    
    const periodIndex = enhancedPrompt.indexOf('.');
    if (periodIndex !== -1) {
        enhancedPrompt = enhancedPrompt.substring(0, periodIndex + 1);
    }
    
    enhancedPrompt = enhancedPrompt.replace(/[\(\[].*?[\)\]]/g, '').trim();
    
    return enhancedPrompt;
}

let imageHistory = JSON.parse(localStorage.getItem('imageHistory')) || [];

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function updateHistory(imageBlob, prompt) {
    const base64Image = await blobToBase64(imageBlob);
    imageHistory.unshift({ url: base64Image, prompt: prompt });
    if (imageHistory.length > 20) {
        imageHistory.pop();
    }
    localStorage.setItem('imageHistory', JSON.stringify(imageHistory));
    displayHistory();
}

function displayHistory() {
    const historyDiv = document.getElementById('history');
    historyDiv.innerHTML = '';
    imageHistory.forEach((item, index) => {
        const img = document.createElement('img');
        img.src = item.url;
        img.alt = `Imagem ${index + 1}`;
        img.title = item.prompt;
        img.onclick = () => showFullImage(item.url, item.prompt);
        historyDiv.appendChild(img);
    });
}

function showFullImage(url, prompt) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalPrompt = document.getElementById('modalPrompt');
    modal.style.display = 'block';
    modalImage.src = url;
    modalPrompt.textContent = `Prompt: ${prompt}`;
}

function closeModal() {
    const modal = document.getElementById('imageModal');
    modal.style.display = 'none';
}

function togglePromptVisibility() {
    const promptText = document.getElementById('promptText');
    if (promptText) {
        promptText.style.display = promptText.style.display === 'none' ? 'block' : 'none';
    }
}

let enhancePrompt = true;

function toggleEnhancePrompt() {
    enhancePrompt = !enhancePrompt;
    const enhanceToggle = document.getElementById('enhanceToggle');
    enhanceToggle.classList.toggle('active', enhancePrompt);
    enhanceToggle.title = enhancePrompt ? "Aprimoramento de prompt ativado" : "Aprimoramento de prompt desativado";
    localStorage.setItem('enhancePrompt', enhancePrompt);
}

async function generateOrEnhanceImage() {
    const promptInput = document.getElementById('prompt');
    const userPrompt = promptInput.value.trim();
    if (!userPrompt) {
        alert('Por favor, insira um prompt.');
        return;
    }
    
    promptInput.value = '';
    
    const genArtTitle = document.getElementById('genArtTitle');
    genArtTitle.classList.add('color-changing');
    
    if (enhancePrompt) {
        await enhanceAndGenerateImage(userPrompt);
    } else {
        await generateImageWithoutEnhancement(userPrompt);
    }
    
    genArtTitle.classList.remove('color-changing');
}

async function enhanceAndGenerateImage(userPrompt) {
    const resultContainer = document.getElementById('result-container');
    const resultDiv = document.getElementById('result');
    
    const generationElement = document.createElement('div');
    generationElement.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Aprimorando o prompt...</p>
    `;
    resultDiv.insertBefore(generationElement, resultDiv.firstChild);
    resultContainer.style.display = 'block';
    
    try {
        const enhancedPrompt = await queryPromptEnhancement(userPrompt);
        if (!enhancedPrompt) {
            throw new Error('Prompt aprimorado vazio');
        }
        generationElement.innerHTML = `
            <div class="loading-spinner"></div>
            <p>Gerando imagem com o prompt aprimorado...</p>
        `;
        
        const response = await query({"inputs": enhancedPrompt});
        const imageUrl = URL.createObjectURL(response);
        
        generationElement.innerHTML = `
            <img src="${imageUrl}" alt="Imagem gerada" class="fade-in">
            <p id="promptText" style="display: none;">Prompt original: ${userPrompt}<br>Prompt aprimorado (em inglês): ${enhancedPrompt}</p>
            <div class="prompt-toggle" onclick="togglePromptVisibility(this)"><i class="fas fa-eye"></i></div>
        `;
        await updateHistory(response, enhancedPrompt);
    } catch (error) {
        generationElement.innerHTML = `<p style="color: red;">Erro ao gerar a imagem. Por favor, tente novamente.</p>`;
        console.error('Erro:', error);
    }
}

async function generateImageWithoutEnhancement(userPrompt) {
    const resultContainer = document.getElementById('result-container');
    const resultDiv = document.getElementById('result');
    
    const generationElement = document.createElement('div');
    generationElement.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Gerando imagem com o prompt original...</p>
    `;
    resultDiv.insertBefore(generationElement, resultDiv.firstChild);
    resultContainer.style.display = 'block';
    
    try {
        const response = await query({"inputs": userPrompt});
        const imageUrl = URL.createObjectURL(response);
        
        generationElement.innerHTML = `
            <img src="${imageUrl}" alt="Imagem gerada" class="fade-in">
            <p id="promptText" style="display: none;">Prompt original: ${userPrompt}</p>
            <div class="prompt-toggle" onclick="togglePromptVisibility(this)"><i class="fas fa-eye"></i></div>
        `;
        await updateHistory(response, userPrompt);
    } catch (error) {
        generationElement.innerHTML = `<p style="color: red;">Erro ao gerar a imagem. Por favor, tente novamente.</p>`;
        console.error('Erro:', error);
    }
}

function togglePromptVisibility(element) {
    const promptText = element.previousElementSibling;
    promptText.style.display = promptText.style.display === 'none' ? 'block' : 'none';
}

function confirmClearHistory() {
    if (confirm('Tem certeza de que deseja limpar o histórico?')) {
        clearHistory();
    }
}

function clearHistory() {
    imageHistory = [];
    localStorage.removeItem('imageHistory');
    displayHistory();
}

displayHistory();

function handleKeyPress(event) {
    if (event.key === "Enter") {
        generateOrEnhanceImage();
    }
}

document.getElementById('prompt').addEventListener('keypress', handleKeyPress);

window.addEventListener('load', function() {
    const enhancePromptState = localStorage.getItem('enhancePrompt');
    if (enhancePromptState !== null) {
        enhancePrompt = enhancePromptState === 'true';
        const enhanceToggle = document.getElementById('enhanceToggle');
        enhanceToggle.classList.toggle('active', enhancePrompt);
    }
}); 