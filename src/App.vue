<template>
  <main class="d-flex flex-column gap-1 gap-xl-3 container mt-1">
    <div>
      Status: {{ aiTrainingService.getStatus().value }}
    </div>
    <div class="d-flex flex-column flex-xl-row gap-3 mt-1">
      <section class="d-flex game flex-column">
        <game-table ref="gameTableRef" :tile-size="5"/>
        <button @click="resetGame" :disabled="aiTrainingService.getBlockInput().value" class="btn-danger">reset grid</button>
      </section>
      <section class="d-flex score flex-column gap-1">
        <div class="d-flex flex-column">
          <span>Aktueller score: <span aria-label="The current score achieved by the ai">{{ gameService.getCurrentScore().value }}</span></span>
          <span>Max Score: <span aria-label="The max score achieved by the ai">{{ gameService.getMaxScore().value }}</span></span>
          <label for="table_size_input" class="form-label">Table Size</label>
          <input v-model="tableSize" type="number" min="4" max="50" id="table_size_input" :disabled="aiTrainingService.getBlockInput().value" class="form-control" aria-describedby="table_size_help">
          <div id="table_size_help" class="form-text">The size of the grid</div>
        </div>
        <div class="d-flex flex-column">
          <div>
            <label for="current_model" class="form-label">Current loaded model</label><br>
            <select id="current_model" class="form-select" v-model="currentlySelectedModel" :disabled="aiTrainingService.getBlockInput().value" aria-describedby="current_model_help">
              <option v-for="model in Object.keys(modelService.getModels().value)" :value="model">
                {{model}}
              </option>
            </select>
            <div id="current_model_help" class="form-text">The model to load to use</div>
          </div>

          <label for="memory_slots_input" class="form-label">Memory Slots</label>
          <input type="number" min="1" max="100000" id="memory_slots_input" v-model="memorySlots" :disabled="aiTrainingService.getBlockInput().value" class="form-control" aria-describedby="memory_slots_help">
          <div id="memory_slots_help" class="form-text">How much memory to give the neural network</div>
          <label for="training_delay_input" class="form-label">Step delay</label>
          <div class="form-check">
            <input type="checkbox" class="form-check-input" id="disable_delay" :disabled="aiTrainingService.getBlockInput().value" v-model="noDelay">
            <label for="disable_delay" class="form-check-label">Disable delay</label>
          </div>
          <input type="number" min="1" max="10000" id="training_delay_input" v-model="trainingDelay" :disabled="aiTrainingService.getBlockInput().value || noDelay" class="form-control" aria-describedby="training_delay_help">
          <div id="training_delay_help" class="form-text">How much time between the steps performed by the neural network</div>
          <label for="steps_input" class="form-label">Steps per game</label>
          <input type="number" min="1" max="10000" id="steps_input" v-model="steps" :disabled="aiTrainingService.getBlockInput().value" class="form-control" aria-describedby="steps_input_help">
          <div id="steps_input_help" class="form-text">How many steps until the round is complete and the board is reset</div>
          <label for="training_rounds_input" class="form-label">Rounds per training</label>
          <input type="number" min="1" max="10000" id="training_rounds_input" v-model="trainingRounds" :disabled="aiTrainingService.getBlockInput().value" class="form-control" aria-describedby="steps_input_help">
          <div id="training_rounds_input_help" class="form-text">How many rounds until the training is complete</div>
        </div>
        <div class="btn-group">
          <button type="button" class="btn btn-primary" :disabled="aiTrainingService.getBlockInput().value || !aiTrainingService.getModel().value" @click="play">Play a round</button>
          <button type="button" class="btn btn-primary" :disabled="aiTrainingService.getBlockInput().value" @click="createNewModel">New Model</button>
          <button type="button" class="btn btn-primary" :disabled="aiTrainingService.getBlockInput().value || !currentlySelectedModel" @click="loadModel" id="load_current_model">Load Model</button>
          <button type="button" class="btn btn-primary" :disabled="aiTrainingService.getBlockInput().value || !aiTrainingService.getModel().value" @click="train">Train Model</button>
          <button type="button" class="btn btn-primary" :disabled="aiTrainingService.getBlockInput().value || !aiTrainingService.getModel().value" @click="saveModel">Save current model</button>
          <button type="button" class="btn btn-warning" :disabled="aiTrainingService.getBlockInput().value || !aiTrainingService.getModel().value" @click="overwriteModel">Overwrite current model</button>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, Ref, onMounted, watch, toRaw } from "vue";
import GameTable from "./components/game-table.vue";
import * as tfvis from "@tensorflow/tfjs-vis";
import { initializeServices, getGameService, getAITrainingService, getModelService, getConfigService } from "./services/ServiceContainer";

// Initialize services
initializeServices();

// Get services from container
const gameService = getGameService();
const aiTrainingService = getAITrainingService();
const modelService = getModelService();
const configService = getConfigService();

// References to services
const gameTableRef: Ref<typeof GameTable|null> = ref(null);

// UI bindings with two-way data binding to services
const tableSize = ref(gameService.getTableSize().value);
const currentlySelectedModel = ref(modelService.getCurrentlySelectedModel().value);
const memorySlots = ref(configService.getAIConfig().memorySlots);
const steps = ref(aiTrainingService.getSteps().value);
const trainingRounds = ref(aiTrainingService.getTrainingRounds().value);
const trainingDelay = ref(aiTrainingService.getTrainingDelay().value);
const noDelay = ref(aiTrainingService.getNoDelay().value);

// Set up watchers to update services when UI values change
watch(tableSize, (newValue) => {
  gameService.setTableSize(newValue);
});

watch(currentlySelectedModel, (newValue) => {
  modelService.setCurrentlySelectedModel(newValue);
});

watch(memorySlots, (newValue) => {
  // This would need to be handled differently since Memory is not a service yet
  // For now, we'll update the config
  configService.updateAIConfig({ memorySlots: newValue });
});

watch(steps, (newValue) => {
  aiTrainingService.setSteps(newValue);
});

watch(trainingRounds, (newValue) => {
  aiTrainingService.setTrainingRounds(newValue);
});

watch(trainingDelay, (newValue) => {
  aiTrainingService.setTrainingDelay(newValue);
});

watch(noDelay, (newValue) => {
  aiTrainingService.setNoDelay(newValue);
});

// Game functions
function resetGame() {
  gameService.reset();
}

// Model functions
async function createNewModel() {
  await modelService.createNewModel();
}

async function loadModel() {
  await modelService.loadModel();
}

async function saveModel() {
  await modelService.saveModel();
}

async function overwriteModel() {
  await modelService.overwriteModel();
}

// AI Training functions
async function play() {
  await aiTrainingService.play();
}

async function train() {
  await aiTrainingService.train();

  // Show model visualization
  const model = aiTrainingService.getModel().value;
  if (model) {
    const surface = { name: 'Model Summary', tab: 'Model Inspection'};
    const surface1 = { name: 'Model Summary', tab: 'Model Layer 1'};
    const surface2 = { name: 'Model Summary', tab: 'Model Layer 2'};
    const surface3 = { name: 'Model Summary', tab: 'Model Layer 3'};
    const surface4 = { name: 'Model Summary', tab: 'Model Layer 4'};
    tfvis.show.modelSummary(surface, toRaw(model.network));
    tfvis.show.layer(surface1, toRaw(model.network.getLayer(undefined, 0)));
    tfvis.show.layer(surface2, toRaw(model.network.getLayer(undefined, 1)));
    tfvis.show.layer(surface3, toRaw(model.network.getLayer(undefined, 2)));
    tfvis.show.layer(surface4, toRaw(model.network.getLayer(undefined, 3)));
    if (!tfvis.visor().isOpen()) {
      tfvis.visor().open();
    }
  }
}

onMounted(async () => {
  // Initialize services if needed
});
</script>
