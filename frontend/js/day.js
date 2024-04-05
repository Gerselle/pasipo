let PLAYING_ROW;
let WEBSITE_ALBUM;

async function start(){
  await dayListeners();
  await parseDayPath();
  if(!CURRENT_USER){ await updateCurrentUser(); }
}

document.addEventListener("update", async (update) => {
  if(update.detail.script === "day"){
    update.detail.start ? start() : await parseDayPath();
  }else if (update.detail.script === "player") {
    const track_id = update.detail.track_id;
    const new_playing_row = album_tracklist.querySelector(`[track_id="${track_id}"]`);
    if(new_playing_row){
      if( PLAYING_ROW ){ PLAYING_ROW.classList.remove("playing"); }
      new_playing_row.classList.add("playing");
      PLAYING_ROW = new_playing_row;
    }
  }
})

docId("album_tracklist").addEventListener("click", (event) => {
  const row = event.target.closest("tr");
  if(!row){ return; }
  const track_index = row.getAttribute("track_index");

  if(CURRENT_USER.active_token){
    sendEvent(playerEvent, {action: "setTrack", data: track_index});
  }else{
    if(PLAYING_ROW == row){
      WEBSITE_AUDIO.paused ? WEBSITE_AUDIO.play() : WEBSITE_AUDIO.pause();
    }else{
      const preview =  WEBSITE_ALBUM.track_list[track_index].preview;
      if(!preview){
        displayError(row, "No preview audio available for album.");
      }else{
        WEBSITE_AUDIO.src = preview;
        WEBSITE_AUDIO.load();
      }
    }
  }
  
  if( PLAYING_ROW ){ PLAYING_ROW.classList.remove("playing"); }
  row.classList.add("playing");
  PLAYING_ROW = row;
});

async function parseDayPath(){
  const path = window.location.pathname;
  let path_user = path.split("/")[1] || "local";
  const path_date = path.substring(path.indexOf("/", 2) + 1);
  const today = dayjs(path_date).isValid() ? dayjs(path_date) : dayjs();
  sessionSet("selected_date", today.format("MMM DD, YYYY"));
  sessionSet("calendar_date", today.startOf('month').format("MMM DD, YYYY"));
  sessionSet("selected_album", null);
 
  if(path_user === "local"){
    sessionSet("viewed_user", JSON.stringify({is_current_user: true, user_name: CURRENT_USER.user_name}));
  }else{
    await fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/viewing/${path_user}`)
          .then(async(response) => {
            let viewed_user = await response.json();
            if(viewed_user.error){
              viewed_user = {user_name: "local", albums: {}, ratings: {}};
              displayError(null, `User ${capitalize(path_user)} not found, redirecting...`);
              setTimeout(() => {
                window.location.pathname = `/local${today.format("/YYYY/M/D")}`
              }, ERROR_LENGTH);
            }
            sessionSet("viewed_user", JSON.stringify(viewed_user));
          });
  }
  
  updateAlbum();
  updateCalendar();
}

function dayListeners(){
  // Handler for clicking on calendar dates
  docId("calendar").addEventListener("click", function (event){
    const day = event.target.closest("div.day");
    if(day && day.getAttribute("date")){
      sessionSet("selected_album", null);
      sessionSet("selected_date", day.getAttribute("date"));
      toggleCalendar();
    }
  });
}

docId("album_rating").addEventListener("mousemove", mouseRating);
docId("album_rating").addEventListener("mouseout", mouseRating);
docId("album_rating").addEventListener("mouseover", mouseRating);
docId("album_rating").addEventListener("click", mouseRating);
let CURRENT_RATING;
function mouseRating(event){
  const viewed_user = JSON.parse(sessionGet("viewed_user")); 
  if(!viewed_user.is_current_user){ return; }

  switch(event.type){
    case "mousemove":
      let round = Math.round((event.offsetX/event.target.offsetWidth) * 10) * 10;
      docId("rating_level").style.width = `${round}%`;
    break;
    case "mouseover":
      CURRENT_RATING = docId("rating_level").style.width;
      break;
    case "mouseout":
      docId("rating_level").style.width = CURRENT_RATING;
      break;
    case "click":
      let new_rating = Math.round((event.offsetX/event.target.offsetWidth) * 10) * 10;
      CURRENT_RATING = `${new_rating}%`;
      updateRating([new_rating/10]);
    break;
  }
}

async function updateRating(rating){
  const album = await albumOfDate(sessionGet("selected_date"));
  fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/action`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      field: "rating",
      action: "update",
      data: {
        id: album.id,
        rating: [parseInt(rating)]
      }
      })
    })
  dbAccess("user_ratings", {id:album.id, rating: rating}, "update");
}

async function albumOfDate(date){
  if(!date){ return null; }
  const user_date = await dbAccess("user_albums", date, "get");
  if(!user_date){ return null; }
  return await dbAccess("albums", user_date.id, "get") || await getAlbum(user_date.id, true);
}

async function getAlbum(album_id, db_checked = false){
  if(!album_id){ return null; }
  
  // If we already checked the database, don't check it again and instead check with server fetch
  let db_album = db_checked ? null : await dbAccess("albums", album_id, "get");
  return db_album ? db_album : await fetchAlbum(album_id);
  
  async function fetchAlbum(album_id){
    const response = await fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/album_id/${album_id}`);
    const album = await response.json();
    return album.error ? null : album;
  }
}

function moveDate(increment){
    // Require user to select a new album for each date
    sessionSet("selected_album", null);
  
    const date = docId("date");
    let selected_date = dayjs(sessionGet("selected_date"), "MMM DD, YYYY");
  
    selected_date = increment ? selected_date.add(1, 'day') : selected_date.subtract(1, 'day');
  
    date.innerHTML = selected_date.format("MMM DD, YYYY");
    sessionSet("selected_date", date.innerHTML);
  
    updateAlbum();
}

function moveMonth(increment){
  let month = dayjs(sessionGet("calendar_date"), "MMM DD, YYYY");
  month = increment ? month.add(1, 'month') : month.subtract(1, 'month');
  sessionSet("calendar_date", month.format("MMM DD, YYYY"));
  updateCalendar();
}

async function setDate(value){
  // Require user to select a new album for each date
  sessionSet("selected_album", null);
  sessionSet("selected_date", value);
  updateAlbum();
  toggleCalendar();
}

async function updateCalendar(){
  let current_day = dayjs(sessionGet("calendar_date")).startOf('month');
  docId("months").innerHTML = `${current_day.format("MMM")}`;
  docId("years").innerHTML = `${current_day.format("YYYY")}`;
  const calendar_offset = current_day.day();
  const calendar_end = (current_day.daysInMonth() + calendar_offset) <= 35 ? 35 : 42;
  const month_end = current_day.endOf('month').add(1, 'day');
  const calendar_days = [];
  const viewed_user = JSON.parse(sessionGet("viewed_user"));

  // Getting all the days of the month, all days will be json objects,
  // but only days with albums will have a non-null name/image
  for(let i = 0; !current_day.isSame(month_end, 'day'); i++){
    let album;

    if(viewed_user.is_current_user){
      album = await albumOfDate(current_day.format("MMM DD, YYYY"));
    }else{
      album = await getAlbum(viewed_user.albums[current_day.format("MMM DD, YYYY")]);
    }

    const selected = current_day.isSame(dayjs(sessionGet("selected_date"), "MMM DD, YYYY"));
    const day = {num: i + 1, selected: selected, date: current_day.format("MMM DD, YYYY")}

    if(album){
      day["name"] = album.name;
      day["image"] = album.image;
    }

    calendar_days[i] = day;
    current_day = current_day.add(1, 'day');
  }

  // calendar_offset is the day of the week the first day of the month is.
  const calendar = [];
  for(let i = calendar_offset; i < calendar_end; i++){
    calendar[i] = calendar_days[i - calendar_offset];
  }

  const calendar_element = docId("calendar_dates");
  calendar_element.innerHTML = "";

  for(let i = 0; i < calendar.length; i++){
    calendar_element.appendChild(dayChild(calendar[i]));
  }

  function dayChild(day_children){
    let day = document.createElement("div");
    day.className = "day";
    if(day_children){
      day.setAttribute("date", day_children.date);
      day.className = day.className + " clickable"
      if(day_children.selected){
        day.className = day.className + " focused";
      }

      const num = document.createElement("div");
      num.setAttribute("class", "num");
      num.innerHTML = day_children.num;
  
      day.appendChild(num);
      if(day_children.name != null){
        const img = document.createElement("img");
        img.setAttribute("src", day_children.image);
        img.setAttribute("alt", day_children.name);
        day.appendChild(img);
      }
    }    

    return day;
  }
}

function toggleCalendar(){
  updateAlbum();
  const selected_date = sessionGet("selected_date");
  sessionSet("calendar_date", dayjs(selected_date).startOf('month').format("MMM DD, YYYY"));
  updateCalendar();
  const calendar = docId("calendar");
  calendar.style.display = calendar.style.display === "none" ? "flex" : "none";
}

async function addAlbum(album){
  const selected_date = sessionGet("selected_date");
  const current_album = await albumOfDate(selected_date);

  if(current_album == null){
    if(userLoggedIn()){
      fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/action`, {
      'method': "POST",
      'headers': { "Content-Type": "application/json" },
      'body': JSON.stringify({
        field: "album",
        action: "add",
        data: {
          id: album.id,
          date:  dayjs(selected_date)
              }
        })
      });
    }
  }
}

async function sendAlbumUpdate(){
  const selected_album = JSON.parse(sessionGet("selected_album"));
  const selected_date = sessionGet("selected_date");

  if(selected_album == null){return;}

  if(userLoggedIn()){
    fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/action`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      field: "album",
      action: "update",
      data: {
        id: selected_album.id,
        date:  dayjs(selected_date)
      }
    })
    })
  }

  dbAccess("user_albums", {date: selected_date, id:selected_album.id}, "update");
  updateAlbum(selected_album);
}

async function sendAlbumDelete(){
  if(userLoggedIn()){
    fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/action`, {
    'method': "POST",
    'headers': { "Content-Type": "application/json" },
    'body': JSON.stringify({
      field: "album",
      action: "delete",
      data: {
        date:  dayjs(sessionGet("selected_date"))
      }
    })
    })
  }

  dbAccess("user_albums", sessionGet("selected_date"), "delete");
  updateAlbum();
}

// Search html
const album_search = docId("search_button");
const album_query = docId("search_bar");
const search_results = docId("search_results");
album_query.addEventListener("keyup", searchInput);
album_search.addEventListener("click", searchAlbum);
search_results.addEventListener("click", searchAlbum);
const debouncedSearch = debounce(async () => presearchAlbum(), 200);

async function searchInput(event){
  if(event.key == "Enter"){
    searchAlbum();
  }else if(album_query.value.length > 2){
    debouncedSearch();
  }else{
    search_results.innerHTML = "";
  }
}

async function presearchAlbum(){
  const query = {
    'q'         : album_query.value,
    'query_by'  : 'name,artists.name,track_list.name,aliases',
    'pre_segmented_query': true,
    'drop_tokens_threshold': 0
  }

  let query_result = await TS_CLIENT.collections('albums').documents().search(query).catch(e => {});            
  
  if(!query_result) return;
  let presearch = [];
  let results = "";
  
  if(query_result.hits.length > 0){
    for(let i = 0; i < query_result.hits.length; i++){
      let album = query_result.hits[i].document;
      presearch[i] = album;
      dbAccess("albums", album, "add");
      results += `\t<li value=${i}>${album.name} by ${album.artists[0].name}</li>\n`
    }  
  }

  search_results.innerHTML = results;
  sessionSet("presearch", JSON.stringify(presearch));
}

async function searchAlbum(event = null) {
  search_results.innerHTML = ""; // Clear search suggestions
  let album;

  if(event && event.target.nodeName === "LI"){
    const presearch = JSON.parse(sessionGet("presearch"));
    album = presearch[event.target.value];
  }else{
    await fetch(`http://${ENV.SERVER_ADDRESS + ENV.NODE_PORT}/search`, {
      'method': "POST",
      'headers': { "Content-Type": "application/json" },
      'body': JSON.stringify({ "album_query": album_query.value})
    }).then(async (response) => album = await response.json());
  }

  if(album.url){
    await addAlbum(album);
    dbAccess("user_albums", {date: sessionGet("selected_date"), id: album.id}, "add");
    dbAccess("albums", album, "add");
    sessionSet("selected_album", JSON.stringify(album));
    updateAlbum(album);
  }else{
    displayError(docId("search"), "Error in finding album, please use another query term.");
  }
}

async function updateAlbum(set_album = null){
  if(!WEBSITE_AUDIO.paused){ WEBSITE_AUDIO.pause(); }

  const options_panel = docId("select");
  options_panel.style.display = "none";
  
  const current_album = docId("current_album");
  current_album.style.display = "none";

  const selected_date = sessionGet("selected_date");
  const date = docId("date");
  date.innerHTML = selected_date;

  const viewed_user = JSON.parse(sessionGet("viewed_user"));
  const album_rating = docId("rating_level");
  let album;
  let rating;

  if(viewed_user.is_current_user){
    selected_album = await albumOfDate(selected_date);
    album = set_album ? set_album : selected_album;
    
    if(selected_album && selected_album.id !== album.id){
      current_album.innerHTML = selected_album ? `<span>Current Album: <i>${selected_album.name}</i> by <b>${selected_album.artists[0].name}</b></span>` : "";
      current_album.style.display = selected_album ? "flex" : "none";
      options_panel.style.display = selected_album ? "flex" : "none"; 
    }

    user_rating = album ? await dbAccess("user_ratings", album.id, "get") : null;
    rating = user_rating ? user_rating.rating : null;
  }else{
    const viewed_name = viewed_user.profile_name || viewed_user.user_name;
    date.innerHTML = `${capitalize(viewed_name)}'s ${selected_date}`;
    const album_id = viewed_user.albums[selected_date];
    rating = viewed_user.ratings[album_id];
    album = await dbAccess("albums", album_id, "get") || await getAlbum(viewed_user.albums[selected_date]);
  }

  album_rating.style.width = rating ? `${rating[0] * 10}%` : "0%";
  window.history.pushState({}, "", `/${viewed_user.user_name}${dayjs(selected_date).format("/YYYY/M/D")}`);

  displayAlbum(album);
}

async function displayAlbum(album){
  if(album){
    const album_img = docId("album_img");
    const album_artists = docId("album_artists");
    const album_title = docId("album_title");
    const album_genres = docId("album_genres");
  
    album_img.href = album.url;
    album_img.innerHTML = `
      \n<img src="${album.image}" alt="${album.name}">`;
    
    let artists = "";

    album.artists.forEach((artist, index) => {
      const comma = index == album.artists.length - 1 ? "" : ","; 
      artists += ` <a href="${artist.url}">${artist.name}${comma}</a>`;
    });
    album_artists.innerHTML = artists;
  
    album_title.innerHTML = album.name;
    album_title.href = album.url;

    let genres = capitalize(album.genres[0]) || "No genres";
    for(let i = 1; i < 3; i++){
      if(album.genres[i]){
        genres += `, ${capitalize(album.genres[i])}`;
      }
    } 
  
    album_genres.innerHTML = genres;
  
    const tracklist = docId("album_tracklist");
    tracklist.innerHTML = "";
  
    let tracklist_update = `<tr><th colspan="3" id="album_secret">${dayjs().format("MM/DD")} - ${album.name} - ${album.artists[0].name} - ${genres}</th></tr>\n\t\t`; 

    album.track_list.forEach(track => {
      const track_index = album.track_list.indexOf(track);

      tracklist_update += 
      ` <tr track_index=${track_index} track_id=${track.id}>
          <td class="num">${track_index + 1}</td>
          <td class="title">${track.name}</td>
          <td class="no-select num time">${dayjs(track.length).format("mm:ss")}</td>
        </tr>
      `
    });

    tracklist.innerHTML = tracklist_update;
    WEBSITE_ALBUM = album;
    sendEvent(playerEvent, {action: "loadAlbum", data: album});
  }

  docId("album").style.display = album ? "flex" : "none";
}