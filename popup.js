document.addEventListener('DOMContentLoaded', function() {

    // Select DOM elements
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');
    const input = document.getElementById('selectedText');
    const analyseButton = document.getElementById('analyseButton');
    const outputText = document.getElementById('outputText');
    const imgText = document.getElementById('imgText');
    const suggestionText = document.getElementById('suggestionText');
    const probSideText = document.getElementById('probSideText');
    const priorityImageContainer = document.getElementById('priorityImageContainer');
    const priorityImage = document.getElementById('priorityImage');

    let selectedText = '';
    document.getElementById('myModal').style.display = 'none';

    // Handle tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => {
                t.classList.remove('active');
                t.querySelector('i').style.color = '#160299'; 
            });
            contents.forEach(content => content.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
            tab.querySelector('i').style.color = 'white';
        });
    });

    // Update selectedText on input change and button state
    input.addEventListener('input', () => {
        selectedText = input.value;
        updateButtonState();
    });
    
    // Enable/disable the analyse button based on text input
    function updateButtonState() {
        if (selectedText.trim() !== '') {
            analyseButton.disabled = false;
        } else {
            analyseButton.disabled = true;
        }
    }

    // Handle selected data from the extension
    function handleSelectedData(result) {
        if (result) {
            const {
                text
            } = result;
            selectedText = text || "";
            input.value = selectedText;
            input.placeholder = selectedText ? "" : "No text selected";
            updateButtonState();
        } else {
            selectedText = "";
            input.value = "";
            input.placeholder = "No text selected";
            updateButtonState();
        }
    }

    // Send selected text to the API for analysis
    function sendTextToAPI(text) {
        chrome.storage.local.get(['apiKey'], function(result) {
            const apiKey = result.apiKey;

            if (!apiKey) {
                alert('API key not found!');
                document.getElementById('myModal').style.display = 'none';
                return;
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=${apiKey}`;
            const prompt = `
            You are an expert in gender bias and sexism. Your mission is create equal world with detecting gender bias and sexist statements. If given input is related with gender bias or sexism, you should give response.
            If the input is not related with gender bias or sexism, you should say your mission is only analyse and detect gender bias or sexism statements in given inputs.
            
            If main subject related with gender bias or sexism and then for each instance you identify:
                - Why it's problematic: Provide a concise explanation of why the identified instance is an issue.
                - Suggestions for Improvement: Offer precise suggestions on how the input can be revised to eliminate the problematic aspect.
        
            
            If main subject related with gender bias or sexism and then follow below rules:
            
                Your analysis should be clear, direct, and insightful.
            
                Your response should be in json format. Our input format will be list. You have to analyse for each element of list based on gender bias and sexism.
            
                Keys must be detected problematic information about maculanity and sexism inside of for each element of input and the label should be "Detected Input".
                You should aggregate all of the detected inputs in one key if detected input is related with gender bias or sexism otherwise you should say your mission is only analyse and detect gender bias or sexism statements in given inputs.
            
                Evaluate the seriousness of detected gender bias or sexist content as "High Risk", "Medium Risk" or "Low Risk" based on content and labeled as "Risk Status". You should evaluate all of the instances and give response only average of results in one key.
            
                Risk categories evaluation must based on below examples. 
            
                High Risky content examples:
                "Real men don't cry; showing emotions is for the weak."
                "Women are too emotional to handle leadership positions."
                
                You must to avoid give these examples in your response.
                
                Medium Risky content examples:
                "Men should be the primary breadwinners in a family."
                "She's pretty good at math for a woman."
                
                You must to avoid give these examples in your response.
                
                Low Risky content examples:
                "He enjoys traditionally masculine activities like sports and cars."
                "It's important to have diverse perspectives in the workplace, including gender diversity."
                
                You must to avoid give these examples in your response.
                
                Based on your comments about gender bias and sexism, values should be why it's problematic and labeled as "Problematic Side" . You should aggregate all of the Problematic Sides in one key.
                Suggestions for improvement labeled as "Suggestions". You should aggregate all of the Suggestions in one key.
                
                Give response after analyse all of the paragraph only one aggregated json format.
        
                If the input is not related with gender bias or sexism, you should say your mission is only analyse and detect gender bias or sexism statements in given inputs.
                
                You should not give instructions how to analyse input when the input is not related with gender bias or sexism.`;

            let hasTextResult = false;
            // Function to display results
            function displayResults() {
                document.getElementById('myModal').style.display = 'none';

                if (hasTextResult) {
                    outputText.style.display = 'block';
                    imgText.style.display = 'block';
                    probSideText.style.display = 'block';
                    suggestionText.style.display = 'block';
                } else {
                    outputText.style.display = 'block';
                    outputText.innerHTML = `<p style="font-style: italic;">No evidence of gender bias or prejudicial language in the submitted text.</p>`
                }
            }
            // Handle Text
            if (text.length > 0) {
                fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: text
                                }]
                            }],
                            systemInstruction: {
                                parts: [{
                                    text: prompt
                                }]
                            },
                            safetySettings: [{
                                    category: "HARM_CATEGORY_HATE_SPEECH",
                                    threshold: "BLOCK_NONE",
                                },
                                {
                                    category: "HARM_CATEGORY_HARASSMENT",
                                    threshold: "BLOCK_NONE",
                                },
                                {
                                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                                    threshold: "BLOCK_NONE",
                                },
                                {
                                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                                    threshold: "BLOCK_NONE",
                                },
                            ],
                            generationConfig: {
                                temperature: 0,
                                candidateCount: 1,
                                maxOutputTokens: 4000,
                            }
                        }),
                    })
                    .then((response) => response.json())
                    .then((result) => {
                        const jsonDataString = result["candidates"][0]["content"]["parts"][0]["text"];
                        try {
                            const cleanedJsonData = jsonDataString.trim().replace(/^```json|```$/g, '');
                            jsonData = JSON.parse(cleanedJsonData);

                            if (jsonData["Detected Input"].length !== 0) {
                                hasTextResult = true;
                                displayTextResults(jsonData);
                            }
                        } catch (e) {
                            outputText.innerHTML = `<p style="font-style: italic;">No evidence of gender bias or prejudicial language in the submitted text.</p>`;
                        }
                        displayResults();
                    })
                    .catch((error) => {
                        alert('API key is not valid.');
                        document.getElementById('myModal').style.display = 'none';
                    });
            }
        });
    }

    // Display results from the API in the DOM
    function displayTextResults(jsonData) {
        const detectedInput = jsonData["Detected Input"];
        let formattedDetectedInput = "<h4>Detected Input</h4>";
        detectedInput.forEach((item, index) => {
            formattedDetectedInput += `<p>${index + 1}: ${item}</p>`;
        });
        outputText.innerHTML = formattedDetectedInput;
        imgText.innerHTML = "<h4>Risk Status</h4>";
        const risk = jsonData["Risk Status"];
        displayRiskImage(risk);

        const probSide = jsonData["Problematic Side"];
        let formattedProbSide = "<h4>Problematic Side</h4>";
        probSide.forEach((item, index) => {
            formattedProbSide += `<p>${index + 1}: ${item}</p>`;
        });
        probSideText.innerHTML = formattedProbSide;

        const suggestions = jsonData["Suggestions"];
        let formattedSuggestion = "<h4>Suggestions</h4>";
        suggestions.forEach((item, index) => {
            formattedSuggestion += `<p>${index + 1}: ${item}</p>`;
        });
        suggestionText.innerHTML = formattedSuggestion;
    }
    // Display appropriate risk image based on the risk level
    function displayRiskImage(risk) {
        switch (risk) {
            case "High Risk":
                priorityImage.src = 'icons/high_icon_png.png';
                break;
            case "Medium Risk":
                priorityImage.src = 'icons/medium_icon_png.png';
                break;
            case "Low Risk":
                priorityImage.src = 'icons/low_icon_png.png';
                break;
            default:
                priorityImageContainer.style.display = 'none';
                return;
        }
        priorityImageContainer.style.display = 'block';
    }
    // Handle analyse button click
    analyseButton.addEventListener('click', () => {
        if (!analyseButton.disabled) {
            if (selectedText.trim() !== '') {
                sendTextToAPI(selectedText);
                document.getElementById('myModal').style.display = 'flex';
            }
        }
    });
    // Fetch selected text from the active tab
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function(tabs) {
        chrome.scripting.executeScript({
            target: {
                tabId: tabs[0].id
            },
            function: getSelectedText
        }, (results) => {
            if (results && results[0] && results[0].result) {
                handleSelectedData(results[0].result);
            } else {
                handleSelectedData(null);
            }
        });
    });

    // Get selected text 
    function getSelectedText() {
        const selection = window.getSelection();
        const selectedText = selection.toString();

        return {
            text: selectedText
        };
    }
    // Adjust the textarea size on input
    input.addEventListener('input', adjustTextareaSize);
    adjustTextareaSize();

    function adjustTextareaSize() {
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';
    }
    // Save API key
    document.getElementById('saveApiKey').addEventListener('click', function() {
        const apiKey = document.getElementById('apiKey').value;

        if (apiKey) {
            chrome.storage.local.set({
                apiKey: apiKey
            }, function() {
                alert('API key saved successfully!');
                document.getElementById('myModal').style.display = 'none';
                document.getElementById('saveApiKey').disabled = true;
                document.getElementById('deleteApiKey').style.display = 'inline';
            });
        } else {
            alert('Please enter a valid API key.');
            document.getElementById('myModal').style.display = 'none';
        }
    });
    // Delete API key 
    document.getElementById('deleteApiKey').addEventListener('click', function() {
        chrome.storage.local.remove('apiKey', function() {
            alert('API key deleted successfully!');
            document.getElementById('myModal').style.display = 'none';
            document.getElementById('saveApiKey').disabled = false;
            document.getElementById('deleteApiKey').style.display = 'none';
            document.getElementById('apiKey').value = '';
        });
    });

    chrome.storage.local.get(['apiKey'], function(result) {
        if (result.apiKey) {
            document.getElementById('saveApiKey').disabled = true;
            document.getElementById('deleteApiKey').style.display = 'inline';
            document.getElementById('apiKey').value = result.apiKey;
        }
    });
});