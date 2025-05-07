<template>
  <main class="d-flex flex-column gap-1 gap-xl-3 container mt-1">
    <div>
      Status: {{ status }}
    </div>
    <div class="d-flex flex-column flex-lg-row gap-3 mt-1">
      <section class="d-flex flex-column row-gap-1">
        <game-table @lost="lost_fn" @won="won_fn" ref="game_table" v-model:current_score="current_score" :table-size="table_size" />
        <button @click="clicked" :disabled="block_input" class="btn btn-danger">reset grid</button>
      </section>
      <section class="d-flex score flex-column gap-1">
        <div class="d-flex flex-column">
          <span>Aktueller score: <span aria-label="The current score achieved by the ai">{{current_score}}</span></span>
          <span>Max Score: <span aria-label="The max score achieved by the ai">{{max_score}}</span></span>
          <label for="table_size_input" class="form-label">Table Size</label>
          <input v-model="table_size" type="number" min="4" max="50" id="table_size_input" :disabled="true" class="form-control" aria-describedby="table_size_help">
          <div id="table_size_help" class="form-text">The size of the grid</div>
        </div>
        <div class="d-flex flex-column">
          <div>
            <label for="current_model" class="form-label">Current loaded model</label><br>
            <select id="current_model" class="form-select" v-model="currently_selected_model" :disabled="block_input" aria-describedby="current_model_help">
              <option v-for="model in Object.keys(models)" :value="model">
                {{model}}
              </option>
            </select>
            <div id="current_model_help" class="form-text">The model to load to use</div>
          </div>

          <label for="memory_slots_input" class="form-label">Memory Slots</label>
          <input type="number" min="1" max="100000" id="memory_slots_input" v-model="memory_slots" :disabled="block_input" class="form-control" aria-describedby="memory_slots_help">
          <div id="memory_slots_help" class="form-text">How much memory to give the neural network</div>
          <label for="training_delay_input" class="form-label">Step delay</label>
          <div class="form-check">
            <input type="checkbox" class="form-check-input" id="disable_delay" :disabled="block_input" v-model="no_delay">
            <label for="disable_delay" class="form-check-label">Disable delay</label>
          </div>
          <input type="number" min="1" max="10000" id="training_delay_input" v-model="training_delay" :disabled="block_input || no_delay" class="form-control" aria-describedby="training_delay_help">
          <div id="training_delay_help" class="form-text">How much time between the steps performed by the neural network</div>

          <label for="batch_size_help_input" class="form-label">Batch Size</label>
          <input type="number" min="1" max="10000" id="batch_size_help_input" v-model="batch_size" :disabled="block_input" class="form-control" aria-describedby="batch_size_help">
          <div id="batch_size_help" class="form-text">How many samples the model gets when replaying</div>

          <label for="steps_input" class="form-label">Steps per game</label>
          <input type="number" min="1" max="10000" id="steps_input" v-model="steps" :disabled="block_input" class="form-control" aria-describedby="steps_input_help">
          <div id="steps_input_help" class="form-text">How many steps until the round is complete and the board is reset</div>
          <label for="training_rounds_input" class="form-label">Rounds per training</label>
          <input type="number" min="1" max="10000" id="training_rounds_input" v-model="training_rounds" :disabled="block_input" class="form-control" aria-describedby="steps_input_help">
          <div id="training_rounds_input_help" class="form-text">How many rounds until the training is complete</div>
        </div>
        <div class="btn-group">
          <button type="button" class="btn btn-primary" :disabled="block_input || !model" @click="play">Play a round</button>
          <button type="button" class="btn btn-primary" :disabled="block_input" @click="new_model">New Model</button>
          <button type="button" class="btn btn-primary" :disabled="block_input || !currently_selected_model" @click="load_model" id="load_current_model">Load Model</button>
          <button type="button" class="btn btn-primary" :disabled="block_input || !model" @click="train">Train Model</button>
          <button type="button" class="btn btn-primary" :disabled="block_input || !model" @click="save">Save current model</button>
          <button type="button" class="btn btn-warning" :disabled="block_input || !model" @click="overwrite">Overwrite current model</button>
          <button type="button" class="btn btn-danger" :disabled="block_input || !currently_selected_model" @click="delete_model">Delete current model</button>
        </div>
      </section>
    </div>
  </main>
  <div class="toast-container position-fixed top-0 end-0 p-3">
    <div id="liveToast" ref="liveToast" class="toast text-bg-danger" role="alert" aria-live="assertive" aria-atomic="true" data-bs-autohide="false">
      <div class="toast-header">
        <strong class="me-auto">Error</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">
        An error occurred. More details in the console.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  watchEffect,
  Ref,
  onMounted,
  watch,
  toRaw,
  onBeforeMount,
  shallowRef,
  markRaw,
} from "vue";
import GameTable from "./components/game-table.vue";
import {Orchestrator} from "./Orchestrator";
import {Memory} from "./Memory";
import {Model} from "./Model";
import {io, loadLayersModel} from "@tensorflow/tfjs";
import * as tfvis from "@tensorflow/tfjs-vis";
import {Toast} from "bootstrap";

const table_size = ref(6);
const max_score = ref(0);
const current_score = ref(0);
const models = ref({});
const game_table: Ref<typeof GameTable|null> = ref(null);
const liveToast: Ref<HTMLDivElement|null> = ref(null);
const currently_selected_model = ref("");
const model: Ref<Model|null> = shallowRef(null);
const memory_slots = ref(5000);
//@ts-ignore
const memory: Ref<Memory> = shallowRef(new Memory(memory_slots.value));
const orchestrator: Ref<Orchestrator|null> = ref(null);
const training_delay = ref(10);
const no_delay = ref(true);
const steps = ref(1000);
const training_rounds = ref(10);
const block_input = ref(false);
const batch_size = ref(64);

const status = ref("idle");

const MODEL_SAVE_PATH_ = 'indexeddb://game-model-'


watch([model, memory, steps, training_delay, no_delay], () => {
  if (!model.value) {
    return
  }
  orchestrator.value = markRaw(new Orchestrator(game_table.value!!, model.value, memory.value, steps.value, training_delay.value, no_delay.value));
});

watch(memory_slots, () => {
  memory.value = markRaw(new Memory(memory_slots.value));
});

watchEffect(() => {
  if (current_score.value > max_score.value) {
    max_score.value = current_score.value;
  }
}, { flush: 'post' });

function sleep(time: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), time)
  })
}

async function load_model() {
  model.value = markRaw(new Model(table_size.value * table_size.value, 4, batch_size.value, await loadLayersModel(currently_selected_model.value)));
}

async function new_model() {
  model.value = markRaw(new Model(table_size.value * table_size.value, 4, batch_size.value))
}

async function play() {
  if (!orchestrator.value) {
    console.error("No orchestrator!");
    return
  }
  status.value = "Playing"
  block_input.value = true;
  game_table.value?.reset();
  let needed_steps = 0;
  while (true) {
    const [lost, won] = await orchestrator.value.just_play();
    needed_steps++;
    if (lost || won) {
      break
    }
    await sleep(training_delay.value)
  }
  status.value = "idle"
  block_input.value = false;
  console.log("Steps performed:", needed_steps);
}

onBeforeMount(() => {
  const settings_string = localStorage.getItem("settings");
  if (settings_string) {
    const settings = JSON.parse(settings_string);
    memory_slots.value = settings["memory_slots"]
    steps.value = settings["steps"]
    training_rounds.value = settings["training_rounds"]
    no_delay.value = settings["no_delay"]
    table_size.value = settings["table_size"]
    training_delay.value = settings["training_delay"]
    batch_size.value = settings["batch_size"] ?? 64
  }
  watch([memory_slots, steps, training_rounds, no_delay, table_size, training_delay, batch_size], ([memory_slots, steps, training_rounds, no_delay, table_size, training_delay, batch_size]) => {
    const save_obj = {
      memory_slots, steps, training_rounds, no_delay, table_size, training_delay, batch_size
    }
    localStorage.setItem("settings", JSON.stringify(save_obj))
  });
});

onMounted(async () => {
  models.value = await io.listModels();
});

function lost_fn() {
  console.log("You lost");
}

function won_fn() {
  console.log("You won");
}

function clicked() {
  game_table.value?.reset()
}

async function delete_model() {
  await io.removeModel(currently_selected_model.value);
  currently_selected_model.value = "";
  models.value = await io.listModels();
}

async function save() {
  if (!model.value) {
    console.error("No model");
    return;
  }
  status.value = "Saving model";
  let i = Object.keys(await io.listModels()).length + 1;
  await toRaw(model.value).saveModel(MODEL_SAVE_PATH_ + i);
  status.value = `Saved model as ${MODEL_SAVE_PATH_ + i}`;
  models.value = await io.listModels();
}

async function overwrite() {
  if (!currently_selected_model.value) {
    console.error("No currently selected model");
    return
  }
  if (!model.value) {
    console.error("No model");
    return;
  }
  status.value = `Saving model as ${currently_selected_model.value}`;
  await toRaw(model.value).saveModel(currently_selected_model.value);
  status.value = `Saved model as ${currently_selected_model.value}`;
}

async function train() {
  if (!orchestrator.value) {
    console.error("No Orchestrator");
    return;
  }
  if (!model.value) {
    console.error("No model");
    return;
  }
  if (!game_table.value) {
    console.error("No game table")
    return;
  }

  game_table.value.reset();
  block_input.value = true;
  await sleep(100);
  for (let i = 0; i < training_rounds.value; i++) {
    status.value = `Training round ${i+1}`;
    console.log(`Training round ${i+1}`);
    await orchestrator.value.run();
    if (!no_delay.value) {
      await sleep(100);
    }
  }
  block_input.value = false;
  status.value = "idle";
  const surface = { name: 'Model Summary', tab: 'Model Inspection'};
  const surface1 = { name: 'Model Summary', tab: 'Model Layer 1'};
  const surface2 = { name: 'Model Summary', tab: 'Model Layer 2'};
  const surface3 = { name: 'Model Summary', tab: 'Model Layer 3'};
  const surface4 = { name: 'Model Summary', tab: 'Model Layer 4'};
  void tfvis.show.modelSummary(surface, toRaw(model.value.network));
  void tfvis.show.layer(surface1, toRaw(model.value.network.getLayer(undefined, 0)));
  void tfvis.show.layer(surface2, toRaw(model.value.network.getLayer(undefined, 1)));
  void tfvis.show.layer(surface3, toRaw(model.value.network.getLayer(undefined, 2)));
  void tfvis.show.layer(surface4, toRaw(model.value.network.getLayer(undefined, 3)));
  if (!tfvis.visor().isOpen()) {
    tfvis.visor().open();
  }
}

window.addEventListener('error', function(event) {
  console.error('Error captured:', event)
  const toastBootstrap = Toast.getOrCreateInstance(liveToast.value!);
  toastBootstrap.show();
  event.preventDefault();
});

window.addEventListener('unhandledrejection', function(event) {
  console.error('Error captured:', event)
  const toastBootstrap = Toast.getOrCreateInstance(liveToast.value!);
  toastBootstrap.show();
  event.preventDefault();
});
</script>
