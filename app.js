//Importar librerias, funciones y variables globales

const Discord = require('discord.js');

const botconfig = require('./botconfig.json');

const Search = require('./src/Search');

const Play = require('./src/Play');

const spdl = require('spdl-core')

const Queue = require('./src/Queue');

const Song = require('./src/Song')

const RichEmbed = require('./src/RichEmbed')

const version = botconfig.version

let servers = {}

function formatDuration(duration) {
    let seconds = duration / 1000;
    return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)}`;
}

//Loguear Bot

const bot = new Discord.Client();

bot.login(botconfig.token)

bot.on('ready', () => {
    console.log('Bot is online')
    bot.user.setPresence({ game: { name: '!help para más info' } })
})

//Mensajes

bot.on('message', async message => {

    const prefix = botconfig.prefix
    const messageArray = message.content.split(' ')
    const cmd = messageArray[0].toLowerCase()
    let args = messageArray.slice(1).join(' ')

    //Evitar que el Bot se responda a si mismo
    if (message.author.bot) {
        return
    }

    //Mensajes de informacion

    if (cmd === `${prefix}info`) {

        const embed = new Discord.MessageEmbed()
            .addField('Creado por', 'Lumel')
            .addField('Version: ', version)
            .addField('Agregar a tu canal', 'https://bit.ly/2ILf5Cr')
        message.channel.send(embed)
    }

    if (cmd === `${prefix}help`) {
        const embed = new Discord.MessageEmbed()
            .setTitle('Lista de comandos')
            .addField(`${prefix}info`, 'Muestra información sobre el bot')
            .addField(`${prefix}play {cancion/artista}`, 'Busca música en YouTube y la reproduce automáticamente en el canal de audio o las agrega a la cola de reproducción(Tenés que estar en un canal de audio)')
            .addField(`${prefix}search {cancion/artista}`, 'Busca música en YouTube y muestra los primeros 5 resultados para que elijas cuál reproducir(Tenés que estar en un canal de audio')
            .addField(`${prefix}playing`, 'Muestra información sobre la canción que se está reproduciendo en el momento')
            .addField(`${prefix}queue`, 'Muestra la cola de reproducción de audio')
            .addField(`${prefix}pause`, 'Pausa la reproducción')
            .addField(`${prefix}resume`, 'Reanuda la reproducción')
            .addField(`${prefix}skip`, 'Pasa a la próxima canción de la cola de reproducción')
            .addField(`${prefix}stop`, 'Detiene la reproducción y vacía la cola de reproducción')
            .addField(`${prefix}jump`, 'Salta al número de track que se indique')
            .addField(`${prefix}remove`, 'Elimina el número de track que se indique')
            .addField(`${prefix}join`, 'Agrega al bot al canal de audio(Tenés que estar en un canal de audio)')
            .addField(`${prefix}leave`, 'Expulsa al bot del canal de audio(Tenés que estar en un canal de audio)')
        message.channel.send(embed)
    }

    //Mensajes exclusivos de Dueño    

    if (message.author.username === botconfig.owner) {

        switch (cmd) {

            case `${prefix}delete`:

                args++
                if (args <= 100) {
                    message.channel.bulkDelete(args).catch((err) => {
                        console.log(err)
                    })
                } else {
                    message.channel.send('Seleccione un valor del 1 al 99')
                }

                break;

            case `${prefix}kick`:

                const user = message.mentions.users.first();

                if (user) {

                    const member = message.guild.member(user);

                    if (member) {

                        member.kick().then(() => {

                            message.reply(`${user.tag} ha sido expulsado del canal`);
                        }).catch(err => {
                            message.reply('No fue posible expulsar al usuario');
                            console.log(err)
                        });
                    } else {
                        message.reply('El usuario no está en el canal');
                    }
                } else {
                    message.reply('No mencionaste ningún usuario');
                }

            default:
                break;
        }
    }

    //Comandos Voice Channel

    const channel = message.member.voice.channel


    if (channel) {

        if (!servers[message.guild.id]) servers[message.guild.id] = new Queue()
        const server = servers[message.guild.id]
        let searchResults

        switch (cmd) {

            case `${prefix}join`:

                if (!message.guild.voice) {
                    channel.join().catch((err) => {
                        console.log(err)
                    })
                } else {
                    message.channel.send('Ya estoy en un canal de voz')
                }

                break;

            case `${prefix}leave`:
                if (channel) {

                    if (message.guild.voice.channel) {
                        message.guild.voice.channel.leave()
                    } else {
                        message.channel.send('No estoy en ningún canal de voz')
                    }
                } else {
                    message.channel.send('No estas en un canal de voz')
                }
                break;

            case `${prefix}play`:
                if (!args) {
                    message.channel.send('Especificá un criterio de búsqueda')
                    return
                }

                if (spdl.validateURL(args)) {

                    let song

                    const info = await spdl.getInfo(args)

                    song = new Song(args, `${info.artists} - ${info.title}`, info.thumbnail, formatDuration(info.duration))
                    server.addSong(song)
                } else {

                    let results = await Search(args)

                    song = new Song(results.items[0].url, results.items[0].title, results.items[0].bestThumbnail.url, results.items[0].duration)
                    server.addSong(song)
                }

                if (!message.guild.voice) {
                    const connection = await channel.join()
                    Play(connection, message, server)

                } else if (!message.guild.voice.connection || !message.guild.voice.connection.dispatcher) {
                    const connection = await channel.join()
                    Play(connection, message, server)
                } else {
                    message.channel.send(`${song.title} se agregó a la cola de reproducción`)
                }

                break;

            case `${prefix}pause`:

                if (message.guild.voice.connection) {
                    if (message.guild.voice.connection.dispatcher) message.guild.voice.connection.dispatcher.pause()
                }

                break;

            case `${prefix}resume`:

                if (message.guild.voice.connection) {
                    if (message.guild.voice.connection.dispatcher) message.guild.voice.connection.dispatcher.resume()
                }

                break;

            case `${prefix}search`:

                if (!args) {
                    message.channel.send('Especificá un criterio de búsqueda')
                    return
                }

                searchList = await Search(args)
                searchList = searchList.items.filter((song, i) => i < 5)
                searchList = searchList.map(song => song = new Song(song.url, song.title, song.bestThumbnail.url, song.duration))

                message.channel.send('Respondé con el numero de opción (1-5) para agregarla a la cola de reproducción...')
                searchList.forEach((song, i) => {
                    const embed = RichEmbed(song, i + 1)
                    message.channel.send(embed)
                })

                break;

            case `${prefix}playing`:

                if (server && !server.isEmpty()) {
                    const embed = RichEmbed(server.getFirstSong())
                    message.channel.send(embed)

                } else {
                    message.channel.send('No se está reproduciendo nada en este momento')
                }

                break;

            case `${prefix}skip`:

                if (server && message.guild.voice) {

                    if (!server.isEmpty() && message.guild.voice.connection) {

                        server.queue.shift()

                        if (!server.isEmpty()) {
                            const connection = await channel.join()
                            Play(connection, message, server)
                        } else {
                            message.guild.voice.connection.disconnect()
                        }
                    }
                }
                break;

            case `${prefix}stop`:

                if (server && message.guild.voice) {

                    if (message.guild.voice.connection) {
                        server.empty()
                        message.guild.voice.connection.disconnect()
                    }

                }
                break;

            case `${prefix}queue`:

                if (server && server.queue.length > 1) {
                    server.queue.forEach((song, i) => {
                        if (i < 1) return
                        const embed = RichEmbed(song, i)
                        message.channel.send(embed)
                    })
                } else {
                    message.channel.send('No hay canciones en la cola de reproducción')
                }

                break;

            case `${prefix}jump`:

                if (!args) {
                    message.channel.send('Especificá un número de track')
                    return
                }

                server.queue = server.queue.filter((song, i) => !(i < args))

                const connection = await channel.join()
                Play(connection, message, server)

                break;

            case `${prefix}remove`:

                if (!args) {
                    message.channel.send('Especificá un número de track')
                    return
                }

                if (server && !server.isEmpty()) {
                    if (parseInt(args) >= 1) {

                        server.queue.forEach((song, i) => {
                            if (i < 1) return
                            if (parseInt(args) === i) {
                                message.channel.send(`${song.title} eliminada de la cola de reproducción`)
                                server.queue.splice(i, 1)
                            }
                        })
                    }
                } else {
                    message.channel.send('No hay canciones en la cola de reproducción')
                }

                break;
        }

        if (/^[1-5]$/.test(cmd)) {

            if (server && searchList) {
                server.addSong(searchList[parseInt(cmd) - 1])
                if (!message.guild.voice) {
                    const connection = await channel.join()
                    Play(connection, message, server)

                } else if (!message.guild.voice.connection || !message.guild.voice.connection.dispatcher) {
                    const connection = await channel.join()
                    Play(connection, message, server)
                } else {
                    message.channel.send(`${server.getFirstSong().title} se agregó a la cola de reproducción`)
                }
            }
        }

    } else {
        message.channel.send('No estas en un canal de voz')
    }
})