<template>
  <div class="game-table">
    <table>
      <tbody>
        <tr v-for="tiles in partition(state, props.tableSize)">
          <td v-for="tile in tiles">
            <div class="d-flex align-items-center justify-content-center" :style="{...tile_style, 'background-color': numberToColor[tile]}">
              {{tile === 0 ? '' : tile}}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script lang="ts" setup>
import {onUnmounted, onMounted, ref, Ref, watch} from "vue";

const emit = defineEmits(["lost", "won", "update:current_score"]);

const numberToColor = {
  0: "#ff9b00",
  2: "gray",
  4: "#ffed97",
  8: "#f36c00",
  16: "#bd5000",
  32: "#ff4c00",
  64: "#ff0000",
  128: "#ffdd00",
  256: "#ffdd00",
  512: "#2eff00",
  1024: "#00fcce",
  2048: "#0017ff"
}

const props = defineProps<{ current_score: number, tableSize: number, tileSize: number }>();

const state: Ref<number[]> = ref(new Array(props.tableSize*props.tableSize).fill(0));

const tile_style = ref({
    "min-height": props.tileSize + "rem",
    "height": props.tileSize + "rem",
    "min-width": props.tileSize + "rem",
    "width": props.tileSize + "rem",
});

const lost = ref(false);
const won = ref(false);

function partition(items: any[], size: number): (0|2|4|8|16|32|64|128|256|512|2048)[][] {
  const p = [];
  for (let i = Math.floor(items.length/size); i-->0; ) {
    p[i]=items.slice(i*size, (i+1)*size);
  }
  return p;
}

function generate_tile() {
  if (lost.value || won.value) {
    return
  }

  let indexes = [];
  for (let i = 0; i < state.value.length; i++) {
    if (state.value[i] === 0) {
      indexes.push(i);
    }
  }
  if (indexes.length === 0) {
    lost.value = true;
    emit("lost");
  } else {
    state.value[indexes[Math.floor((Math.random() * indexes.length))]] = 2;
  }
}

function shift(direction: "left" | "right" | "up" | "down") {
  if (lost.value || won.value) {
    return false;
  }
  switch (direction) {
    case "left":
      for (let i = 0; i < state.value.length / props.tableSize; i++) {
        for (let j = (state.value.length / props.tableSize) * i + 1; j < (state.value.length / props.tableSize) * (i + 1); j++) {
          if (state.value[j] !== 0 && (state.value[j] === state.value[j - 1] || state.value[j - 1] === 0)) {
            if (state.value[j] === state.value[j - 1]) {
              emit("update:current_score", props.current_score + 2);
            }
            state.value[j - 1] += state.value[j];
            state.value[j] = 0;
            if (state.value[j - 1] === 2048) {
              won.value = true;
              emit("won")
            }
          }
        }
      }
      break
    case "down":
      for (let i = state.value.length / props.tableSize - 1; i >= 0; i--) {
        for (let j = i * props.tableSize; j < (i*props.tableSize) + props.tableSize; j++) {
          if (state.value[j] !== 0 && (state.value[j] === state.value[j + props.tableSize] || state.value[j + props.tableSize] === 0)) {
            if (state.value[j] === state.value[j + props.tableSize]) {
              emit("update:current_score", props.current_score + 2);
            }
            state.value[j + props.tableSize] += state.value[j];
            state.value[j] = 0;

            if (state.value[j + props.tableSize] === 2048) {
              won.value = true;
              emit("won")
            }
          }
        }
      }
      break
    case "right":
      for (let i = state.value.length / props.tableSize; i > 0; i--) {
        for (let j = ((props.tableSize * (i - 1)) + props.tableSize) - 1; j > ((i - 1) * props.tableSize); j--) {
          if (state.value[j - 1] !== 0 && (state.value[j] === state.value[j - 1] || state.value[j] === 0)) {
            if (state.value[j] === state.value[j - 1]) {
              emit("update:current_score", props.current_score + 2);
            }
            state.value[j] += state.value[j - 1];
            state.value[j - 1] = 0;
            if (state.value[j] === 2048) {
              won.value = true;
              emit("won")
            }
          }
        }
      }
      break
    case "up":
      for (let i = 1; i < state.value.length / props.tableSize; i++) {
        for (let j = i * props.tableSize; j < (i*props.tableSize) + props.tableSize; j++) {
          if (state.value[j] !== 0 && (state.value[j] === state.value[j - props.tableSize] || state.value[j - props.tableSize] === 0)) {
            if (state.value[j] === state.value[j - props.tableSize]) {
              emit("update:current_score", props.current_score + 2);
            }
            state.value[j - props.tableSize] += state.value[j];
            state.value[j] = 0;

            if (state.value[j - props.tableSize] === 2048) {
              won.value = true;
              emit("won")
            }
          }
        }
      }
      break
  }
  generate_tile();
  return true;
}

function keypress_listener(event: KeyboardEvent) {
  if (lost.value || won.value) {
    return
  }
  if (event.key === "w") {
    shift("up")
  } else if (event.key === "a") {
    shift("left")
  } else if (event.key === "s") {
    shift("down")
  } else if (event.key === "d") {
    shift("right")
  }
}

onUnmounted(() => {
  document.removeEventListener("keypress", keypress_listener);
});

onMounted(() => {
  generate_tile();
  document.addEventListener("keypress", keypress_listener);
});

watch(() => props.tableSize, () => {
  reset();
});

function reset() {
  emit("update:current_score", 0);
  state.value = new Array(props.tableSize*props.tableSize).fill(0);
  won.value = false;
  lost.value = false;
  generate_tile();
}

defineExpose({
  reset,
  state,
  current_score: props.current_score,
  won,
  lost,
  shift
});
</script>

<style scoped lang="sass">
</style>
