<template>
  <div class="game-table">
    <table>
      <tbody>
        <tr v-for="tiles in gameService.partition()">
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
import { onUnmounted, onMounted, ref, computed } from "vue";
import { getGameService } from "../services/ServiceContainer";

// Get the game service from the container
const gameService = getGameService();

const props = defineProps<{ tileSize: number }>();

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

const tile_style = computed(() => ({
  "min-height": props.tileSize + "rem",
  "height": props.tileSize + "rem",
  "min-width": props.tileSize + "rem",
  "width": props.tileSize + "rem",
}));

function keypress_listener(event: KeyboardEvent) {
  if (gameService.isLost().value || gameService.isWon().value) {
    return;
  }

  if (event.key === "w") {
    gameService.shift("up");
  } else if (event.key === "a") {
    gameService.shift("left");
  } else if (event.key === "s") {
    gameService.shift("down");
  } else if (event.key === "d") {
    gameService.shift("right");
  }
}

onUnmounted(() => {
  document.removeEventListener("keypress", keypress_listener);
});

onMounted(() => {
  document.addEventListener("keypress", keypress_listener);
});
</script>

<style scoped lang="sass">
</style>
