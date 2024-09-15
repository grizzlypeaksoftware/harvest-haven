/*** Game Variables ***/
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const tileSize = 50;

let lastTime = 0;
let dayTime = 0;
const dayLength = 60000; // 60 seconds per day

const seasons = ['Spring', 'Summer', 'Fall', 'Winter'];
let currentSeasonIndex = 0;
let daysPerSeason = 30;
let currentDay = 1;

let crops = [];
let achievements = [];
let weather = 'Sunny';

const shop = {
    seeds: {
        corn: 5,
        wheat: 3
    },
    sellPrices: {
        cornSeed: 2,
        wheatSeed: 1,
        corn: 10,
        wheat: 6
    }
}; 

const backgroundImage = new Image();
backgroundImage.src = 'farm-background.png';

const SPRITE_WIDTH = 256; // Assuming each sprite frame is 32 pixels wide
const SPRITE_HEIGHT = 256; // Assuming each sprite frame is 32 pixels high
const GRID_SIZE = 4; // 4x4 grid
const ANIMATION_SPEED = 150; // Milliseconds per frame

const CORN_SPRITE_WIDTH = 256; // Adjust if your spritesheet has different dimensions
const CORN_SPRITE_HEIGHT = 256; // Adjust if your spritesheet has different dimensions
const CORN_GROWTH_STAGES = 4; // Assuming 6 growth stages for corn

// Define garden bed locations (adjust based on your generated image)
const gardenBeds = [
    {x: 98, y: 252, width: 600, height: 300}
    // Add more garden bed locations as needed
];

// Update these variables to use tileSize
const inventoryHeight = 2 * tileSize; // Height of the inventory section
const buttonSize = 0.8 * tileSize; // Size of inventory buttons
const buttonSpacing = 0.2 * tileSize; // Spacing between buttons

// Update canvas size to accommodate the inventory
canvas.height = 12 * tileSize + inventoryHeight; // Assuming the main game area is 12 tiles high

// Load inventory item sprites
const itemSprites = {
    wheat: new Image(),
    wheatSeed: new Image(),
    corn: new Image(),
    cornSeed: new Image()
};
itemSprites.wheat.src = 'wheat.png';
itemSprites.wheatSeed.src = 'wheat-seeds.png';
itemSprites.corn.src = 'corn.png';
itemSprites.cornSeed.src = 'corn-seeds.png';

/*** Classes ***/
class Crop {
    constructor(x, y, type) {
        this.x = x; // Grid position
        this.y = y;
        this.type = type; // 'corn', 'wheat', etc.
        this.growthStage = 0;
        this.watered = false;
        this.maxGrowthStage = 3; // 4 growth stages (0-3) for both corn and wheat
        this.growthTime = 0;
        this.growthInterval = 10000; // 10 seconds per stage
        
        this.spritesheet = new Image();
        if (this.type === 'corn') {
            this.spritesheet.src = 'corn-spritesheet.png';
        } else if (this.type === 'wheat') {
            this.spritesheet.src = 'wheat-spritesheet.png';
        }
    }

    update(deltaTime) {
        if (this.watered && this.growthStage < this.maxGrowthStage) {
            this.growthTime += deltaTime;
            if (this.growthTime >= this.growthInterval) {
                this.growthStage++;
                this.growthTime = 0;
                this.watered = false;
            }
        }
    }

    render(ctx) {
        if ((this.type === 'corn' || this.type === 'wheat') && this.spritesheet.complete) {
            // Draw crop using spritesheet
            ctx.drawImage(
                this.spritesheet,
                this.growthStage * SPRITE_WIDTH,
                0,
                SPRITE_WIDTH,
                SPRITE_HEIGHT,
                this.x * tileSize,
                this.y * tileSize,
                tileSize,
                tileSize
            );
        } else {
            // Fallback or for other crop types
            const colors = ['#228B22', '#32CD32', '#7CFC00', '#ADFF2F'];
            ctx.fillStyle = colors[Math.min(this.growthStage, colors.length - 1)];
            ctx.fillRect(this.x * tileSize + 5, this.y * tileSize + 5, tileSize - 10, tileSize - 10);
        }

        // Draw watered indicator
        if (this.watered) {
            ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
            ctx.fillRect(this.x * tileSize, this.y * tileSize, tileSize, tileSize);
        }
    }
}

class Inventory {
    constructor() {
        this.items = {};
    }

    addItem(itemName, quantity = 1) {
        if (this.items[itemName]) {
            this.items[itemName] += quantity;
        } else {
            this.items[itemName] = quantity;
        }
    }

    removeItem(itemName, quantity = 1) {
        if (this.items[itemName]) {
            this.items[itemName] -= quantity;
            if (this.items[itemName] <= 0) {
                delete this.items[itemName];
            }
        }
    }

    hasItem(itemName, quantity = 1) {
        return this.items[itemName] && this.items[itemName] >= quantity;
    }
}

class Player {
    constructor() {
        this.inventory = new Inventory();
        this.money = 20;
        this.selectedTool = 'hoe';

        this.toolSprites = {
            hoe: new Image(),
            wateringCan: new Image(),
            scythe: new Image()
        };
        this.toolSprites.hoe.src = 'hoe.png';
        this.toolSprites.wateringCan.src = 'watering-can.png';
        this.toolSprites.scythe.src = 'scythe.png';
    }

    interact(action, x, y) {
        switch (action) {
            case 'plant':
                if (this.inventory.hasItem('cornSeed')) {
                    var success = plantSeed(x, y, 'corn');

                    if(success){
                        this.inventory.removeItem('cornSeed');
                    }
                } else if (this.inventory.hasItem('wheatSeed')) {
                    var success = plantSeed(x, y, 'wheat');
                    if(success){
                        this.inventory.removeItem('wheatSeed');
                    }
                } 
                break;
            case 'water':
                waterCrop(x, y);
                break;
            case 'harvest':
                harvestCrop(x, y);
                break;
        }
    }
}

const farmer = new Player();

/*** Functions ***/

// Game Loop
function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    update(deltaTime);
    render();

    requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
    // Update day time
    dayTime += deltaTime;
    if (dayTime >= dayLength) {
        dayTime = 0;
        nextDay();
    }

    // Update crops
    crops.forEach(crop => crop.update(deltaTime));

    // Check achievements
    checkAchievements();
}

// Add this function near the top of your game.js file
function displayWelcomeMessage() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = `${tileSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('Welcome to Harvest Haven!', canvas.width / 2, canvas.height / 2);
    ctx.font = `${tileSize * 0.5}px Arial`;
    ctx.fillText('Click to start your farming adventure', canvas.width / 2, canvas.height / 2 + tileSize);
    ctx.textAlign = 'left'; // Reset text alignment for other text rendering
}

function drawToolButtons(ctx) {
    const buttonSize = 50;
    const spacing = 10;
    const startX = canvas.width - (buttonSize * 3 + spacing * 2) - 10;
    const startY = 10;

    const tools = ['hoe', 'wateringCan', 'scythe'];

    tools.forEach((tool, index) => {
        const x = startX + (buttonSize + spacing) * index;
        
        // Draw button background
        ctx.fillStyle = tool === farmer.selectedTool ? '#4CAF50' : '#ddd';
        ctx.fillRect(x, startY, buttonSize, buttonSize);
        
        // Draw tool sprite
        if (farmer.toolSprites[tool].complete) {
            ctx.drawImage(farmer.toolSprites[tool], x + 5, startY + 5, buttonSize - 10, buttonSize - 10);
        }

        // Draw border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, startY, buttonSize, buttonSize);
    });
}

function handleToolButtonClick(event) {
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const buttonSize = 50;
    const spacing = 10;
    const startX = canvas.width - (buttonSize * 3 + spacing * 2) - 10;
    const startY = 10;

    const tools = ['hoe', 'wateringCan', 'scythe'];

    tools.forEach((tool, index) => {
        const x = startX + (buttonSize + spacing) * index;
        if (clickX >= x && clickX < x + buttonSize &&
            clickY >= startY && clickY < startY + buttonSize) {
            farmer.selectedTool = tool;
        }
    });
}


function render() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

     // Draw tool buttons
     drawToolButtons(ctx);

     // Draw garden bed overlay
     //for debugging
    //drawGardenBedOutline();

      // Draw inventory background
    ctx.fillStyle = '#f0e68c'; // Khaki color for inventory background
    ctx.fillRect(0, canvas.height - inventoryHeight, canvas.width, inventoryHeight);

    // Draw inventory items
    drawInventory();

    // Draw crops
    crops.forEach(crop => crop.render(ctx));

    // Display HUD
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`Season: ${seasons[currentSeasonIndex]} Day: ${currentDay}`, 10, 20);
    ctx.fillText(`Money: $${farmer.money}`, 10, 50);
    ctx.fillText(`Weather: ${weather}`, 10, 80);
}

// Update the drawGardenBedOutline function to include a semi-transparent overlay
function drawGardenBedOutline() {
    gardenBeds.forEach(bed => {
        // Draw semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)'; // Light green with 20% opacity
        ctx.fillRect(bed.x, bed.y, bed.width, bed.height);

        // Draw outline
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'; // Darker green for the outline
        ctx.lineWidth = 2;
        ctx.strokeRect(bed.x, bed.y, bed.width, bed.height);

        // Optional: Add text to show garden bed dimensions
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.fillText(`Garden Bed: (${bed.x}, ${bed.y}, ${bed.width}x${bed.height})`, 
                     bed.x + 5, bed.y + 20);
    });
}

// Update the isInGardenBed function to account for scaling
function isInGardenBed(x, y) {
    // Convert grid coordinates to pixel coordinates
    const pixelX = x * tileSize;
    const pixelY = y * tileSize;
    
    const result = gardenBeds.some(bed => 
        pixelX >= bed.x && pixelX < bed.x + bed.width &&
        pixelY >= bed.y && pixelY < bed.y + bed.height
    );
    
    console.log(`Checking grid (${x}, ${y}) / pixel (${pixelX}, ${pixelY}) in garden bed: ${result}`);
    return result;
}

function plantSeed(x, y, type) {
    var success = false;
    console.log(`Attempting to plant at grid (${x}, ${y})`);
    console.log(`Is in garden bed: ${isInGardenBed(x, y)}`);
    console.log(`Is empty: ${!crops.some(crop => crop.x === x && crop.y === y)}`);
    if (isInGardenBed(x, y) && !crops.some(crop => crop.x === x && crop.y === y)) {
        const newCrop = new Crop(x, y, type);
        crops.push(newCrop);
        success = true;
        console.log('Planting successful');
    } else {
        alert('You can only plant in empty garden beds!');
        console.log('Planting failed');
    }
    return success;
}

function waterCrop(x, y) {
    const crop = crops.find(crop => crop.x === x && crop.y === y);
    if (crop) {
        crop.watered = true;
    } else {
        alert('No crop to water here!');
    }
}

function harvestCrop(x, y) {
    const cropIndex = crops.findIndex(crop => crop.x === x && crop.y === y);
    if (cropIndex !== -1 && crops[cropIndex].growthStage === crops[cropIndex].maxGrowthStage) {
        // Add harvested crop to inventory
        const cropType = crops[cropIndex].type;
        farmer.inventory.addItem(cropType + 'Seed', 2); // Add 2 seeds of the harvested type
        farmer.inventory.addItem(cropType, 1); // Add 1 of the harvested crop
        // Remove crop from the field
        crops.splice(cropIndex, 1);
        //alert(`Harvested ${cropType}! Got 1 ${cropType} and 2 ${cropType} seeds.`);
    } else {
        alert('Crop is not ready to harvest!');
    }
}

function buySeed(seedType) {
    const cost = shop.seeds[seedType];
    if (farmer.money >= cost) {
        farmer.money -= cost;
        farmer.inventory.addItem(seedType + 'Seed');
        updateMoneyDisplay();
    } else {
        alert('Not enough money!');
    }
}


function buyItem(itemType) {
    const seedType = itemType.replace('Seed', '');
    const cost = shop.seeds[seedType];
    if (farmer.money >= cost) {
        farmer.money -= cost;
        farmer.inventory.addItem(itemType);
    } else {
        // Display a message on the canvas instead of using alert
        displayMessage('Not enough money!');
    }
}

function sellItem(itemType) {
    const price = shop.sellPrices[itemType];
    if (farmer.inventory.hasItem(itemType)) {
        farmer.inventory.removeItem(itemType);
        farmer.money += price;
    } else {
        // Display a message on the canvas instead of using alert
        displayMessage(`No ${itemType} to sell!`);
    }
}

function displayMessage(message) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, 30);
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText(message, 10, 20);

    // Clear the message after 2 seconds
    setTimeout(() => {
        ctx.clearRect(0, 0, canvas.width, 30);
    }, 2000);
}


function nextDay() {
    currentDay++;
    if (currentDay > daysPerSeason) {
        currentDay = 1;
        currentSeasonIndex = (currentSeasonIndex + 1) % seasons.length;
    }

    // Update weather
    updateWeather();

    // Reset crops' watered status
    crops.forEach(crop => {
        crop.watered = false;
        // Optional: Wither crops if not watered for several days
    });

    // Apply weather effects
    if (weather === 'Rainy') {
        crops.forEach(crop => crop.watered = true);
    }
}

function updateWeather() {
    const weatherTypes = ['Sunny', 'Rainy', 'Cloudy'];
    weather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
}

function checkAchievements() {
    if (farmer.money >= 1000 && !achievements.includes('Rich Farmer')) {
        achievements.push('Rich Farmer');
        alert('Achievement Unlocked: Rich Farmer!');
        updateAchievementsUI();
    }
    // Add more achievement checks here
}

function updateMoneyDisplay() {
    // Assuming you have an element to display the money
    const moneyDisplay = document.getElementById('moneyDisplay');
    if (moneyDisplay) {
        moneyDisplay.textContent = `Money: $${farmer.money}`;
    }
}

// Add this function to sell items
function sellItem(itemType) {
    const price = shop.sellPrices[itemType];
    if (farmer.inventory.hasItem(itemType)) {
        farmer.inventory.removeItem(itemType);
        farmer.money += price;
        updateMoneyDisplay();
    } else {
        alert(`No ${itemType} to sell!`);
    }
}


/*** Input Handling ***/

// Keyboard input for movement
document.addEventListener('keydown', function(event) {
    switch (event.key) {
        case 'ArrowUp':
            farmer.move(0, -1);
            break;
        case 'ArrowDown':
            farmer.move(0, 1);
            break;
        case 'ArrowLeft':
            farmer.move(-1, 0);
            break;
        case 'ArrowRight':
            farmer.move(1, 0);
            break;
    }
});

// Update the mouse click event listener
canvas.addEventListener('click', function(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clickX = (event.clientX - rect.left) * scaleX;
    const clickY = (event.clientY - rect.top) * scaleY;

    // Check if a tool button was clicked
    if (event.clientY - rect.top < 60) {  // Assuming buttons are at the top
        handleToolButtonClick(event);
        return;
    }

    // Check if the click is in the inventory area
    if (clickY > canvas.height - inventoryHeight) {
        handleInventoryClick(clickX, clickY);
        return;
    } 
    // Handle game area clicks
    const tileX = Math.floor(clickX / tileSize);
    const tileY = Math.floor(clickY / tileSize);

    if (farmer.selectedTool === 'hoe') {
        farmer.interact('plant', tileX, tileY);
    } else if (farmer.selectedTool === 'wateringCan') {
        farmer.interact('water', tileX, tileY);
    } else if (farmer.selectedTool === 'scythe') {
        farmer.interact('harvest', tileX, tileY);
    }
});

function handleInventoryClick(x, y) {
    const inventoryItems = ['cornSeed', 'corn', 'wheatSeed', 'wheat'];
    const startY = canvas.height - inventoryHeight + 0.2 * tileSize;

    inventoryItems.forEach((item, index) => {
        const buttonX = 0.2 * tileSize + (buttonSize + buttonSpacing) * index * 2;
        const buyButtonY = startY + buttonSize + 0.6 * tileSize;
        const sellButtonY = buyButtonY;
        const sellButtonX = buttonX + buttonSize + 0.1 * tileSize;

        // Check if buy button is clicked
        if (x >= buttonX && x < buttonX + buttonSize &&
            y >= buyButtonY && y < buyButtonY + buttonSize / 2) {
            buyItem(item);
        }

        // Check if sell button is clicked
        if (x >= sellButtonX && x < sellButtonX + buttonSize &&
            y >= sellButtonY && y < sellButtonY + buttonSize / 2) {
            sellItem(item);
        }
    });
}

function drawInventory() {
    const inventoryItems = ['cornSeed', 'corn', 'wheatSeed', 'wheat'];
    const startY = canvas.height - inventoryHeight + 0.2 * tileSize;

    inventoryItems.forEach((item, index) => {
        const x = 0.2 * tileSize + (buttonSize + buttonSpacing) * index * 2;
        
        // Draw item sprite
        if (itemSprites[item].complete) {
            ctx.drawImage(itemSprites[item], x, startY, buttonSize, buttonSize);
        }

        // Draw item count
        ctx.fillStyle = 'black';
        ctx.font = `${0.32 * tileSize}px Arial`;
        ctx.fillText(farmer.inventory.items[item] || 0, x + buttonSize / 2, startY + buttonSize + 0.4 * tileSize);

        // Draw buy button
        drawButton(x, startY + buttonSize + 0.6 * tileSize, 'Buy', '#4CAF50');

        // Draw sell button
        drawButton(x + buttonSize + 0.1 * tileSize, startY + buttonSize + 0.6 * tileSize, 'Sell', '#f44336');
    });
}

function drawButton(x, y, text, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, buttonSize, buttonSize / 2);
    ctx.fillStyle = 'white';
    ctx.font = `${0.24 * tileSize}px Arial`;
    ctx.fillText(text, x + 0.1 * tileSize, y + 0.3 * tileSize);
}

document.addEventListener('keyup', function(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        farmer.stopMoving();
    }
});

function updateAchievementsUI() {
    const achievementsList = document.getElementById('achievementsList');
    achievementsList.innerHTML = '';
    achievements.forEach(achievement => {
        const li = document.createElement('li');
        li.textContent = achievement;
        achievementsList.appendChild(li);
    });
}

/*** Start the Game ***/

// Modify your init function to include the welcome message
function init() {
    displayWelcomeMessage();
    canvas.addEventListener('click', startGame, { once: true });
}

function startGame() {
    // Remove the welcome message
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Start the game loop
    requestAnimationFrame(gameLoop);
}

init();