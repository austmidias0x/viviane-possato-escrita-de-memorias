(function () {
  'use strict';

  const root = document.querySelector('[data-h-experience]');
  if (!root) return;

  const body = document.body;
  const offer = body.dataset.offer;
  const quiz = root.querySelector('[data-h-quiz]');
  const steps = Array.from(root.querySelectorAll('[data-h-step]'));
  const result = root.querySelector('[data-h-result]');
  const progress = root.querySelector('[data-h-progress]');
  const progressFill = root.querySelector('[data-h-progress-fill]');
  const progressText = root.querySelector('[data-h-progress-text]');
  const progressInstruction = root.querySelector('[data-h-progress-instruction]');
  const liveCopy = document.querySelector('[data-h-live-copy]');
  const liveKicker = document.querySelector('[data-h-live-kicker]');
  const liveTitle = document.querySelector('[data-h-live-title]');
  const liveText = document.querySelector('[data-h-live-text]');
  const liveStatus = document.querySelector('[data-h-live-status]');
  const personalizedCopy = root.querySelector('[data-h-personalized-copy]');
  const personalizedTitle = root.querySelector('[data-h-personalized-title]');
  const personalizedText = root.querySelector('[data-h-personalized-text]');
  const qualifiedMentorSection = root.querySelector('[data-h-qualified]');
  const unqualifiedMentorSection = root.querySelector('[data-h-unqualified]');
  const pageMarkers = Array.from(document.querySelectorAll('[data-h-page-marker]'));
  const afterSections = Array.from(root.querySelectorAll('[data-h-after]'));
  const totalSteps = steps.length;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const answers = {};
  let started = false;
  let interactionMode = 'keyboard';

  const content = {
    memorias: {
      defaults: {
        kicker: 'As suas respostas organizam esta página',
        title: 'Você tem uma lembrança em mente.',
        text: 'Responda a três perguntas. A página vai acompanhar as suas escolhas e mostrar um ponto de partida possível para a sua escrita.'
      },
      subjects: {
        pessoa: {
          label: 'uma pessoa importante para você',
          title: 'Comece descrevendo essa pessoa em uma cena.',
          text: 'Procure um gesto, uma frase ou uma situação em que essa pessoa apareça fazendo alguma coisa.',
          reply: 'Então vamos procurar uma cena pequena que mostre essa pessoa em ação.',
          focus: 'uma pessoa em uma cena específica',
          courseTitle: 'A pessoa que você escolheu pode aparecer pelas ações que você recorda.',
          courseText: 'As propostas do curso ajudam você a escolher um encontro, uma frase ou um gesto e, a partir desse acontecimento, reconstruir a presença dessa pessoa no texto.',
          reasonText: 'Ao registrar uma cena vivida com essa pessoa, você preserva gestos, palavras e situações que ainda reconhece na relação entre vocês.',
          examples: 'uma conversa na cozinha, um conselho repetido, uma despedida ou um ritual que vocês compartilhavam',
          finalTitle: 'A primeira proposta pode começar pela pessoa que você escolheu.'
        },
        fase: {
          label: 'uma fase da sua vida',
          title: 'Escolha uma cena que represente essa fase.',
          text: 'Escolha um dia, um encontro ou uma decisão que permita ao leitor acompanhar como aquele período era vivido por você.',
          reply: 'Vamos aproximar essa fase até encontrar um acontecimento que possa ser narrado.',
          focus: 'um acontecimento que represente essa fase',
          courseTitle: 'Escolha um acontecimento que represente essa fase.',
          courseText: 'As aulas ajudam você a localizar os marcos daquele período e escolher uma situação que mostre como a vida acontecia, quem estava por perto e o que mudou depois.',
          reasonText: 'Ao narrar um acontecimento daquele período, você registra como vivia, quem estava por perto e quais mudanças consegue reconhecer hoje.',
          examples: 'o primeiro dia em uma cidade, uma mudança de trabalho, uma viagem, um encontro ou uma despedida',
          finalTitle: 'A primeira proposta pode começar pela fase da vida que você escolheu.'
        },
        lugar: {
          label: 'um lugar que continua presente na sua memória',
          title: 'Os detalhes do lugar podem iniciar o texto.',
          text: 'Comece pelo que havia ao redor: a luz, os objetos, os sons e as pessoas que ocupavam aquele espaço com você.',
          reply: 'Você escolheu um lugar. Agora vamos descobrir qual detalhe chama você de volta.',
          focus: 'um lugar reconstruído pelos detalhes',
          courseTitle: 'Observe os detalhes do lugar que voltou à sua memória.',
          courseText: 'Nas práticas, você observa os objetos, os sons, a luz e as pessoas daquele espaço, então escolhe uma situação que permita ao leitor acompanhar o que acontecia ali.',
          reasonText: 'Ao reconstruir esse lugar pelos detalhes, você registra o espaço e as situações que viveu com as pessoas que estavam ali.',
          examples: 'a cozinha da infância, a casa dos avós, uma rua, uma escola ou um lugar visitado em uma viagem',
          finalTitle: 'A primeira proposta pode começar pelo lugar que você ainda recorda em detalhes.'
        },
        familia: {
          label: 'uma história que circula na sua família',
          title: 'Reconstitua uma história repetida pela sua família.',
          text: 'Você pode separar o que ouviu, o que presenciou e o que ainda gostaria de perguntar antes de escrever a cena.',
          reply: 'Vamos encontrar a parte dessa história que você consegue contar a partir do seu olhar.',
          focus: 'uma história de família contada pelo seu olhar',
          courseTitle: 'Separe o que você viveu, o que ouviu e o que ainda gostaria de perguntar.',
          courseText: 'O curso orienta você a registrar o que presenciou, identificar o que ouviu de outras pessoas e escolher qual parte consegue narrar a partir do próprio olhar.',
          reasonText: 'Ao distinguir o que presenciou do que foi contado, você registra a história da família sem apagar as perguntas que continuam abertas.',
          examples: 'uma história repetida nos almoços, uma carta guardada, uma mudança de cidade ou um costume que atravessou gerações',
          finalTitle: 'A primeira proposta pode começar pela história que circula na sua família.'
        }
      },
      signals: {
        imagem: {
          label: 'uma imagem',
          sentence: 'Uma imagem já oferece enquadramento, distância e objetos para descrever',
          reply: 'Observe o que está dentro dessa imagem, quem aparece e o que acontecia alguns minutos antes.',
          practice: 'descrever a imagem como se o leitor estivesse entrando nela',
          courseTitle: 'Descreva o primeiro plano da imagem.',
          courseText: 'Em seguida, identifique quem aparece e recupere o que aconteceu alguns minutos antes ou depois. Com essa sequência, você escreve a cena a partir do que ainda consegue visualizar.',
          module: 'inventario',
          moduleLabel: 'O Inventário Afetivo'
        },
        frase: {
          label: 'uma frase ou uma voz',
          sentence: 'Uma frase pode recuperar o ritmo de uma conversa e a relação entre as pessoas',
          reply: 'Anote a frase como você a escuta e recupere onde ela era dita, por quem e em qual momento.',
          practice: 'escrever a frase e reconstruir a conversa ao redor dela',
          courseTitle: 'Registre a frase antes de reconstruir a conversa.',
          courseText: 'A prática começa registrando as palavras como você ainda as escuta. Depois, você recupera quem falou, onde estavam e o que aquela conversa mudou naquele momento.',
          module: '',
          moduleLabel: 'uma prática de voz e cena'
        },
        sentido: {
          label: 'um cheiro, um som ou um sabor',
          sentence: 'Ao citar um cheiro, um som ou um sabor, você mostra o ambiente sem interromper a cena para explicá-lo',
          reply: 'Esse detalhe pode entrar na primeira linha e conduzir o restante da cena.',
          practice: 'começar pelo sentido que trouxe a lembrança de volta',
          courseTitle: 'Use o cheiro, o som ou o sabor para mostrar o ambiente.',
          courseText: 'A proposta pode começar pelo detalhe que trouxe a lembrança. A partir dele, você reconstrói o espaço, as pessoas e o acontecimento para que o leitor reconheça a situação.',
          module: 'sabores',
          moduleLabel: 'Os sabores da Memória'
        },
        sentimento: {
          label: 'um sentimento difícil de explicar',
          sentence: 'Você pode mostrar um sentimento pelo gesto que fez ou pela frase que evitou naquele momento',
          reply: 'Procure o momento em que esse sentimento apareceu no que você fez, disse ou evitou dizer.',
          practice: 'mostrar o sentimento por meio de uma ação observável',
          courseTitle: 'Mostre o sentimento pelo que aconteceu na cena.',
          courseText: 'Você localiza um gesto, uma fala ou uma decisão daquele período e descreve o que fez. Assim, o leitor percebe o sentimento enquanto acompanha o acontecimento.',
          module: 'linha',
          moduleLabel: 'A Linha do Tempo'
        }
      },
      blocks: {
        inicio: {
          label: 'escolher por onde começar',
          reply: 'O seu primeiro exercício pode ser curto: uma cena, um detalhe e dez minutos de escrita.',
          next: 'Escolher uma única cena e escrever durante dez minutos, sem tentar contar tudo de uma vez.',
          route: 'A Linha do Tempo ajuda a localizar acontecimentos e escolher qual deles pode iniciar uma página.',
          courseTitle: 'Cada módulo termina com uma proposta delimitada.',
          courseText: 'Você recebe um ponto de partida, escolhe uma cena e escreve uma página por vez. A orientação evita que a primeira tentativa precise contar uma vida inteira.'
        },
        palavras: {
          label: 'encontrar palavras que se pareçam com a sua voz',
          reply: 'A sua voz costuma aparecer quando você escreve como contaria a cena para alguém próximo.',
          next: 'Contar a cena em voz alta, registrar as expressões que você usa e levar esse ritmo para o texto.',
          route: 'As práticas de voz ajudam você a reconhecer a forma como já conta as próprias histórias.',
          courseTitle: 'Conte a cena como você falaria com alguém próximo.',
          courseText: 'As propostas ajudam você a falar a cena, observar as expressões que surgem e levar esse ritmo ao rascunho.'
        },
        exposicao: {
          label: 'decidir o que pode permanecer íntimo',
          reply: 'Você escolhe o que escreve, o que compartilha e o que permanece guardado.',
          next: 'Escrever uma primeira versão somente para você e decidir depois se alguma parte será compartilhada.',
          route: 'O curso permite fazer as práticas no seu espaço, sem obrigação de publicar ou mostrar os textos.',
          courseTitle: 'Você decide o que escreve e o que compartilha.',
          courseText: 'Os exercícios podem permanecer privados. Você escreve a primeira versão para si e, depois, escolhe se alguma parte será mostrada a outra pessoa.'
        },
        rotina: {
          label: 'manter uma rotina de escrita',
          reply: 'Uma prática delimitada ajuda a retomar a escrita mesmo nas semanas em que você dispõe de pouco tempo.',
          next: 'Reservar um intervalo curto para uma proposta específica, com começo e fim definidos.',
          route: 'Como o acesso é vitalício, você pode retomar as aulas e as práticas conforme a sua rotina.',
          courseTitle: 'As aulas gravadas permitem retomar a escrita no tempo disponível.',
          courseText: 'Cada proposta tem começo e fim definidos. Você pode concluir uma prática em um intervalo curto, interromper o percurso e voltar ao conteúdo quando quiser.'
        }
      }
    },
    mentoria: {
      defaults: {
        kicker: 'Mapa do seu livro',
        title: 'Viviane começa pelo material que você já escreveu.',
        text: 'Responda a quatro perguntas. O mapa vai registrar o estágio do projeto, o leitor, o ponto que exige orientação e a sua disponibilidade de investimento.'
      },
      stages: {
        ideia: {
          label: 'uma ideia ou um tema',
          title: 'Você pode recortar a ideia antes de organizar os capítulos.',
          text: 'O primeiro trabalho pode definir para quem o livro será escrito, qual questão ele acompanha e quais experiências ajudam a desenvolvê-la.',
          reply: 'O mapa começa pelo recorte: qual leitor você quer acompanhar e qual pergunta conduz o livro.',
          result: 'A ideia ainda está no começo, e a conversa pode avaliar o recorte que orientará a estrutura.',
          mentorshipTitle: 'Viviane começaria definindo o recorte da sua ideia.',
          mentorshipText: 'Viviane ajudaria você a definir a pergunta central, os limites do tema e quais experiências sustentam o livro. Com esses critérios registrados, a estrutura deixa de depender de novas ideias surgindo a cada capítulo.',
          cardTitle: 'Viviane leria o tema, as anotações e as experiências que você pretende incluir.',
          deliverable: 'Uma pergunta central, um recorte de tema e critérios para selecionar o conteúdo.'
        },
        notas: {
          label: 'anotações, aulas ou materiais espalhados',
          title: 'Você pode agrupar o material existente em uma sequência.',
          text: 'Ao agrupar as anotações por pergunta, caso e conceito, você começa a distinguir o que pertence a cada capítulo.',
          reply: 'O mapa vai considerar como esse material pode ser agrupado antes da escrita dos capítulos.',
          result: 'Você já tem matéria-prima, e a conversa pode avaliar como organizá-la em uma sequência de capítulos.',
          mentorshipTitle: 'A mentoria começaria organizando as suas anotações em uma estrutura de livro.',
          mentorshipText: 'Viviane ajudaria você a agrupar aulas, histórias, conceitos e anotações pela função que cada material pode cumprir. Depois, esses grupos passam a orientar a sequência dos capítulos.',
          cardTitle: 'Viviane começaria agrupando as anotações que tratam da mesma pergunta.',
          deliverable: 'Um mapa do material existente, com grupos de conteúdo e uma primeira sequência de capítulos.'
        },
        capitulos: {
          label: 'alguns capítulos escritos',
          title: 'A leitura dos capítulos localiza as decisões de estrutura.',
          text: 'A leitura do conjunto ajuda a localizar repetições, lacunas e mudanças de direção antes que o manuscrito cresça.',
          reply: 'O mapa vai usar os capítulos existentes para localizar a decisão que mais afeta a continuidade.',
          result: 'Os capítulos já permitem avaliar a sequência, as lacunas e o trabalho necessário para continuar.',
          mentorshipTitle: 'A mentoria começaria lendo os seus capítulos como partes do mesmo livro.',
          mentorshipText: 'Viviane observaria o que cada capítulo entrega, onde o argumento se repete e quais passagens ainda precisam ser desenvolvidas. Essa leitura define o que revisar antes de continuar escrevendo.',
          cardTitle: 'Viviane compararia a função, a sequência e as lacunas dos capítulos existentes.',
          deliverable: 'Uma leitura estrutural dos capítulos, com decisões sobre sequência, lacunas e próximos textos.'
        },
        manuscrito: {
          label: 'um primeiro manuscrito',
          title: 'O manuscrito permite revisar o livro como um conjunto.',
          text: 'A revisão pode observar o recorte, a ordem dos capítulos e o que cada parte entrega ao leitor antes do trabalho linha a linha.',
          reply: 'O mapa vai considerar a estrutura completa antes de indicar a próxima revisão.',
          result: 'O manuscrito permite uma leitura de conjunto para definir a ordem das próximas revisões.',
          mentorshipTitle: 'A mentoria começaria pela leitura do manuscrito como um conjunto.',
          mentorshipText: 'Viviane avaliaria o recorte, a ordem dos capítulos e a continuidade das ideias. Essa leitura definiria quais partes precisam ser movidas, desenvolvidas ou reescritas.',
          cardTitle: 'Viviane leria o manuscrito inteiro antes de organizar a revisão.',
          deliverable: 'Um plano de revisão com decisões de estrutura, desenvolvimento e continuidade.'
        }
      },
      readers: {
        profissionais: {
          label: 'profissionais da sua área',
          reply: 'Esse leitor precisa reconhecer situações de trabalho e entender como aplicar as ideias apresentadas.',
          direction: 'profissionais que reconhecem os problemas e os exemplos da sua área',
          mentorshipTitle: 'Vocês escolheriam exemplos de situações que os profissionais da sua área reconhecem.',
          mentorshipText: 'Durante a orientação, vocês verificam quais casos precisam entrar, o que pode ser explicado com a linguagem da área e onde um conceito exige uma demonstração antes da próxima ideia.'
        },
        mudanca: {
          label: 'pessoas que vivem uma mudança específica',
          reply: 'Você pode organizar os capítulos pelas situações que essa pessoa enfrenta, pelas decisões que precisa tomar e pelas dúvidas que aparecem em cada etapa.',
          direction: 'pessoas que estão atravessando uma mudança específica',
          mentorshipTitle: 'Vocês poderiam ordenar os capítulos pelas decisões de quem vive essa mudança.',
          mentorshipText: 'Os capítulos podem ser organizados pelas situações que esse leitor encontra, pelas dúvidas de cada etapa e pelas decisões que ele precisa tomar. A orientação revisa se a ordem acompanha esse percurso.'
        },
        comunidade: {
          label: 'clientes, alunos ou uma comunidade que já acompanha você',
          reply: 'As perguntas que esse público já faz podem ajudar a definir a ordem e a profundidade dos capítulos.',
          direction: 'pessoas que já conhecem o seu trabalho e querem aprofundar o tema',
          mentorshipTitle: 'Vocês poderiam usar as perguntas da sua comunidade para decidir o que cada capítulo precisa explicar.',
          mentorshipText: 'A mentoria usa as dúvidas que clientes e alunos já trazem para separar o que o leitor conhece, o que precisa ser demonstrado e quais exemplos aproximam o conteúdo da prática.'
        },
        indefinido: {
          label: 'um leitor que ainda precisa ser definido',
          reply: 'Definir o leitor será uma das primeiras decisões, porque ela muda os exemplos, a linguagem e a ordem do livro.',
          direction: 'um leitor que ainda precisa ser delimitado',
          mentorshipTitle: 'Vocês definiriam o leitor nas primeiras conversas.',
          mentorshipText: 'Viviane ajudaria você a comparar os públicos possíveis e escolher aquele que orientará os exemplos, a linguagem e a profundidade do livro. Essa escolha acontece antes da ampliação dos capítulos.'
        }
      },
      obstacles: {
        recorte: {
          label: 'recortar o tema',
          reply: 'O recorte pode separar a pergunta central das ideias que pertencem a outros projetos.',
          work: 'Definir a pergunta central, o limite do tema e os critérios usados para escolher o conteúdo.',
          resultTitle: 'Pelas suas respostas, o primeiro trabalho seria delimitar o tema.',
          mentorshipTitle: 'Viviane começaria recortando o tema.',
          mentorshipText: 'No encontro, vocês registrariam a pergunta que conduz o livro e testariam quais ideias respondem a ela. Depois, você poderia selecionar histórias, conceitos e exemplos com base nesse critério.'
        },
        estrutura: {
          label: 'organizar a sequência dos capítulos',
          reply: 'A sequência precisa mostrar por que um capítulo prepara o seguinte e o que o leitor compreende em cada etapa.',
          work: 'Mapear a função de cada capítulo e revisar a sequência antes de ampliar o manuscrito.',
          resultTitle: 'Pelas suas respostas, o primeiro trabalho seria ordenar os capítulos.',
          mentorshipTitle: 'Viviane começaria organizando a sequência dos capítulos.',
          mentorshipText: 'Vocês definiriam o que cada capítulo precisa entregar e por que ele prepara o seguinte. A partir dessa conversa, você poderia ajustar o mapa do livro ou desenvolver o trecho que explica a passagem entre os capítulos.'
        },
        continuidade: {
          label: 'manter a escrita entre uma etapa e outra',
          reply: 'Ao final de cada encontro, você pode sair com uma tarefa de escrita compatível com o tempo disponível até a próxima conversa.',
          work: 'Combinar um trabalho de escrita compatível com a agenda e revisar o material produzido entre os encontros.',
          resultTitle: 'Pelas suas respostas, o primeiro trabalho seria combinar uma tarefa de escrita compatível com a sua agenda.',
          mentorshipTitle: 'Viviane começaria definindo como você escreveria entre os encontros.',
          mentorshipText: 'Vocês poderiam definir uma tarefa de escrita compatível com a sua agenda. Na conversa seguinte, Viviane leria o material produzido e discutiria com você qual trecho trabalhar depois.'
        },
        revisao: {
          label: 'revisar o material existente',
          reply: 'A revisão começa pela função de cada parte, porque esse diagnóstico orienta o que deve ser mantido, movido ou desenvolvido.',
          work: 'Ler o conjunto, registrar as decisões estruturais e organizar a revisão por etapas.',
          resultTitle: 'Pelas suas respostas, o primeiro trabalho seria revisar a função e a ordem de cada parte.',
          mentorshipTitle: 'Viviane começaria revisando a estrutura e, depois, o texto.',
          mentorshipText: 'Primeiro, vocês verificariam a função e a ordem de cada parte. Depois, a revisão avançaria para o desenvolvimento e a continuidade do texto.'
        }
      },
      finance: {
        disponivel: {
          label: 'disponibilidade para investir a partir de R$ 9.997',
          reply: 'A sua disponibilidade permite enviar o diagnóstico para Viviane avaliar o contexto do projeto.',
          qualified: true,
          closingTitle: 'Envie o diagnóstico para Viviane avaliar o seu livro.',
          closingText: 'Você informou disponibilidade para avaliar o investimento a partir de R$ 9.997. O formulário abaixo envia as quatro respostas e permite acrescentar o contexto que Viviane precisa ler antes do contato.'
        },
        planejar: {
          label: 'necessidade de planejar o investimento',
          reply: 'A síntese continuará disponível nesta página para orientar o próximo trabalho enquanto você se planeja.',
          qualified: false,
          closingTitle: 'Você informou que precisa planejar o investimento.',
          closingText: 'Você informou que precisa planejar o investimento a partir de R$ 9.997. A explicação acima registra o material de partida, o leitor e o primeiro trabalho que poderia orientar o acompanhamento.'
        },
        momento: {
          label: 'um momento em que esse investimento não cabe',
          reply: 'A síntese continuará disponível nesta página para mostrar como a mentoria seria aplicada ao seu livro.',
          qualified: false,
          closingTitle: 'Você informou que o investimento não cabe no seu momento.',
          closingText: 'Você informou que o investimento a partir de R$ 9.997 não cabe no seu momento. A página mantém a leitura do estágio, do leitor e do primeiro trabalho para que você entenda o que o acompanhamento faria no seu caso.'
        }
      }
    }
  };

  function emit(eventName, details) {
    if (typeof window.vivianeTrack === 'function') {
      window.vivianeTrack(eventName, details || {});
    }
  }

  function setAfterVisible(visible) {
    afterSections.forEach(function (section) {
      section.hidden = !visible;
      section.classList.toggle('is-revealed', visible);
    });
  }

  function scrollToElement(element) {
    if (!element) return;
    window.dispatchEvent(new CustomEvent('viviane:programmatic-scroll', {
      detail: { duration: reducedMotion.matches ? 100 : 1200 }
    }));
    element.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }

  function focusHeading(container) {
    const heading = container && container.querySelector('[data-h-focus]');
    if (!heading) return;
    window.setTimeout(function () { heading.focus({ preventScroll: true }); }, reducedMotion.matches ? 0 : 360);
  }

  function updateLiveCopy(kicker, title, text, completed) {
    liveCopy.classList.remove('is-updating');
    void liveCopy.offsetWidth;
    liveKicker.textContent = kicker;
    liveTitle.textContent = title;
    liveText.textContent = text;
    liveCopy.classList.add('is-updating');
    liveStatus.textContent = 'A página foi personalizada após a resposta ' + completed + ' de ' + totalSteps + '.';
    pageMarkers.forEach(function (marker, index) {
      marker.classList.toggle('is-active', index < completed);
    });
  }

  function selectedValue(key) {
    return answers[key] || '';
  }

  function setText(selector, value) {
    const element = root.querySelector(selector);
    if (element) element.textContent = value;
  }

  function setAllText(selector, value) {
    root.querySelectorAll(selector).forEach(function (element) {
      element.textContent = value;
    });
  }

  function memoryView() {
    const data = content.memorias;
    const subject = data.subjects[selectedValue('origem')];
    const signal = data.signals[selectedValue('sinal')];
    const block = data.blocks[selectedValue('bloqueio')];
    const completed = Object.keys(answers).length;

    if (!subject) return Object.assign({ completed: 0 }, data.defaults);
    if (!signal) {
      return {
        completed: completed,
        kicker: 'O assunto da sua primeira página',
        title: subject.title,
        text: subject.text
      };
    }
    if (!block) {
      return {
        completed: completed,
        kicker: 'O detalhe escolhido para começar',
        title: signal.sentence + '.',
        text: 'Como você quer escrever sobre ' + subject.label + ', experimente ' + signal.practice + '.'
      };
    }

    return {
      completed: completed,
      kicker: 'O seu ponto de partida',
      title: 'As suas respostas indicam uma cena, um detalhe e um primeiro exercício.',
      text: 'Você quer escrever sobre ' + subject.label + '. ' + signal.sentence + ', e o primeiro passo pode ser ' + block.next.charAt(0).toLowerCase() + block.next.slice(1),
      subject: subject,
      signal: signal,
      block: block
    };
  }

  function mentorView() {
    const data = content.mentoria;
    const stage = data.stages[selectedValue('estagio')];
    const reader = data.readers[selectedValue('leitor')];
    const obstacle = data.obstacles[selectedValue('necessidade')];
    const finance = data.finance[selectedValue('investimento')];
    const completed = Object.keys(answers).length;

    if (!stage) return Object.assign({ completed: 0 }, data.defaults);
    if (!reader) {
      return {
        completed: completed,
        kicker: 'O estágio do projeto',
        title: stage.title,
        text: stage.text
      };
    }
    if (!obstacle) {
      return {
        completed: completed,
        kicker: 'O livro e o seu leitor',
        title: 'O projeto parte de ' + stage.label + '.',
        text: 'Você quer escrever para ' + reader.direction + '. Essa escolha orienta os exemplos, a linguagem e a profundidade de cada capítulo.'
      };
    }
    if (!finance) {
      return {
        completed: completed,
        kicker: 'O trabalho que você escolheu',
        title: 'Você marcou ' + obstacle.label + ' como primeiro trabalho.',
        text: obstacle.work + ' Viviane avaliaria como aplicar esse trabalho ao material que você já tem.'
      };
    }

    return {
      completed: completed,
      kicker: finance.qualified ? 'Diagnóstico pronto para envio' : 'Síntese do diagnóstico pronta',
      title: obstacle.resultTitle,
      text: stage.result + ' Você marcou ' + obstacle.label + ' e informou que escreve para ' + reader.direction + '.',
      stage: stage,
      reader: reader,
      obstacle: obstacle,
      finance: finance
    };
  }

  function currentView() {
    return offer === 'memorias' ? memoryView() : mentorView();
  }

  function renderPersonalization() {
    const view = currentView();
    updateLiveCopy(view.kicker, view.title, view.text, view.completed);
    emit('personalization_step', {
      step: view.completed,
      next_step: Math.min(view.completed + 1, totalSteps),
      intent: steps.map(function (step) { return answers[step.dataset.hKey] || 'pending'; }).join('|')
    });
  }

  function updateProgress() {
    const completed = Object.keys(answers).length;
    const percent = Math.round((completed / totalSteps) * 100);
    progressFill.style.width = percent + '%';
    progressText.textContent = completed < totalSteps
      ? 'Pergunta ' + (completed + 1) + ' de ' + totalSteps
      : 'Respostas concluídas';
    progressInstruction.textContent = completed < totalSteps
      ? 'Escolha uma opção para avançar'
      : 'Veja a síntese abaixo';
    progress.setAttribute('aria-valuenow', String(completed));
    progress.setAttribute('aria-valuetext', progressText.textContent);
  }

  function selectedReply(input, key) {
    if (offer === 'memorias') {
      if (key === 'origem') return content.memorias.subjects[input.value].reply;
      if (key === 'sinal') return content.memorias.signals[input.value].reply;
      return content.memorias.blocks[input.value].reply;
    }
    if (key === 'estagio') return content.mentoria.stages[input.value].reply;
    if (key === 'leitor') return content.mentoria.readers[input.value].reply;
    if (key === 'necessidade') return content.mentoria.obstacles[input.value].reply;
    return content.mentoria.finance[input.value].reply;
  }

  function resetAfter(index) {
    steps.slice(index + 1).forEach(function (step) {
      const key = step.dataset.hKey;
      delete answers[key];
      step.hidden = true;
      step.classList.remove('is-revealed');
      const checked = step.querySelector('input:checked');
      if (checked) checked.checked = false;
      const reply = step.querySelector('[data-h-reply]');
      if (reply) {
        reply.hidden = true;
        reply.textContent = '';
      }
    });
    result.hidden = true;
    body.removeAttribute('data-qualification');
    setAfterVisible(false);
  }

  function revealStep(index) {
    const step = steps[index];
    if (!step) return;
    step.hidden = false;
    step.classList.remove('is-revealed');
    void step.offsetWidth;
    step.classList.add('is-revealed');
  }

  function fillMentorForm(view) {
    const form = document.getElementById('lead-form');
    if (!form || !view.finance) return;
    const mappings = {
      estagio: selectedValue('estagio'),
      leitor: selectedValue('leitor'),
      necessidade: selectedValue('necessidade'),
      investimento: view.finance.label,
      investimento_id: selectedValue('investimento'),
      qualificacao: view.finance.qualified ? 'qualificado' : 'nao_qualificado',
      elegivel_meta_lead: view.finance.qualified ? 'true' : 'false'
    };
    Object.keys(mappings).forEach(function (name) {
      const field = form.querySelector('[name="' + name + '"]');
      if (field) {
        field.value = mappings[name];
        if (name === 'investimento') field.dataset.qualified = view.finance.qualified ? 'true' : 'false';
      }
    });
    const diagnosis = form.querySelector('[name="diagnostico_personalizado"]');
    if (diagnosis) diagnosis.value = view.text;
  }

  function renderResult() {
    const view = currentView();
    result.hidden = false;
    setAfterVisible(true);

    if (offer === 'memorias') {
      result.querySelector('[data-h-result-title]').textContent = 'A sua primeira página pode começar por ' + view.subject.focus + '.';
      result.querySelector('[data-h-result-summary]').textContent = 'A lembrança costuma aparecer como ' + view.signal.label + '. Você marcou ' + view.block.label + ' como a dificuldade para levá-la ao papel. A prática abaixo usa esse detalhe e trabalha essa dificuldade.';
      result.querySelector('[data-h-result-focus]').textContent = view.subject.focus;
      result.querySelector('[data-h-result-practice]').textContent = view.signal.practice;
      result.querySelector('[data-h-result-next]').textContent = view.block.next;
      result.querySelector('[data-h-result-route]').textContent = view.block.route;
      if (personalizedTitle) personalizedTitle.textContent = 'A sua primeira prática pode partir de ' + view.subject.focus + '.';
      if (personalizedText) {
        personalizedText.textContent = 'Você escolheu ' + view.subject.label + ', e essa lembrança costuma voltar como ' + view.signal.label + '. Por isso, a primeira prática propõe ' + view.signal.practice + '.';
      }
      setText('[data-h-memory-course-intro]', view.subject.reasonText);
      setText('[data-h-memory-subject-title]', view.subject.courseTitle);
      setText('[data-h-memory-subject-text]', view.subject.courseText);
      setText('[data-h-memory-signal-title]', view.signal.courseTitle);
      setText('[data-h-memory-signal-text]', view.signal.courseText);
      setText('[data-h-memory-block-title]', view.block.courseTitle);
      setText('[data-h-memory-block-text]', view.block.courseText);
      setText('[data-h-memory-topic-examples]', 'Você pode começar por ' + view.subject.examples + '.');
      setText('[data-h-memory-final-title]', view.subject.finalTitle);

      const modules = Array.from(root.querySelectorAll('[data-h-memory-module]'));
      modules.forEach(function (module) {
        module.classList.remove('is-recommended');
        module.removeAttribute('aria-current');
        const badge = module.querySelector('[data-h-memory-module-badge]');
        if (badge) badge.hidden = true;
      });
      if (view.signal.module) {
        const recommendedModule = root.querySelector('[data-h-memory-module="' + view.signal.module + '"]');
        if (recommendedModule) {
          recommendedModule.classList.add('is-recommended');
          recommendedModule.setAttribute('aria-current', 'step');
          const badge = recommendedModule.querySelector('[data-h-memory-module-badge]');
          if (badge) badge.hidden = false;
        }
        setText('[data-h-memory-module-note]', 'Como a lembrança chegou por ' + view.signal.label + ', o módulo ' + view.signal.moduleLabel + ' contém uma prática próxima da recomendação do seu resultado.');
      } else {
        setText('[data-h-memory-module-note]', 'Como a lembrança chegou por uma frase ou uma voz, a primeira prática combina um exercício de voz com a reconstrução da cena ao redor dessas palavras.');
      }
    } else {
      const qualified = view.finance.qualified;
      body.dataset.qualification = qualified ? 'qualified' : 'not-qualified';
      result.querySelector('[data-h-result-title]').textContent = view.obstacle.resultTitle;
      result.querySelector('[data-h-result-summary]').textContent = view.text;
      result.querySelector('[data-h-result-stage]').textContent = view.stage.label;
      result.querySelector('[data-h-result-reader]').textContent = view.reader.direction;
      result.querySelector('[data-h-result-next]').textContent = view.obstacle.work;
      if (qualifiedMentorSection) qualifiedMentorSection.hidden = !qualified;
      if (unqualifiedMentorSection) unqualifiedMentorSection.hidden = qualified;
      fillMentorForm(view);
      if (personalizedTitle) personalizedTitle.textContent = view.stage.mentorshipTitle;
      if (personalizedText) {
        personalizedText.textContent = view.stage.result + ' Você marcou ' + view.obstacle.label + ' como a parte que precisa ser resolvida para continuar. Na orientação, vocês escolheriam os exemplos e a linguagem pensando em ' + view.reader.direction + '.';
      }
      setText('[data-h-mentor-stage-title]', view.stage.cardTitle);
      setText('[data-h-mentor-stage-text]', view.stage.mentorshipText);
      setText('[data-h-mentor-stage-deliverable]', view.stage.deliverable);
      setText('[data-h-mentor-reader-title]', view.reader.mentorshipTitle);
      setText('[data-h-mentor-reader-text]', view.reader.mentorshipText);
      setText('[data-h-mentor-obstacle-title]', view.obstacle.mentorshipTitle);
      setText('[data-h-mentor-obstacle-text]', view.obstacle.mentorshipText);
      setAllText('[data-h-mentor-finance-title]', view.finance.closingTitle);
      setAllText('[data-h-mentor-finance-text]', view.finance.closingText);
      setText('[data-h-mentor-result-note]', qualified
        ? 'Leia a explicação personalizada e, em seguida, envie este contexto para Viviane.'
        : 'A explicação personalizada mostra como o acompanhamento seria aplicado ao seu projeto.');
      emit('qualification_select', {
        qualified: qualified,
        step: 'investment',
        stage: selectedValue('estagio'),
        intent: selectedValue('investimento')
      });
    }

    updateProgress();
    const completionPayload = {
      step: totalSteps,
      next_step: 'result',
      intent: steps.map(function (step) { return answers[step.dataset.hKey]; }).join('|')
    };
    const personalizationPayload = {
      step: totalSteps,
      next_step: 'result'
    };
    if (offer === 'mentoria') {
      completionPayload.qualified = view.finance.qualified;
      personalizationPayload.qualified = view.finance.qualified;
    }
    emit('quiz_complete', completionPayload);
    emit('personalization_complete', personalizationPayload);
    liveStatus.textContent = offer === 'memorias'
      ? 'A síntese da sua lembrança está disponível depois da última pergunta.'
      : 'A síntese do seu livro está disponível depois da última pergunta.';
  }

  function markExperienceStarted(trigger) {
    if (started) return;
    started = true;
    emit('quiz_start', { step: 0, next_step: 1, trigger: trigger || 'first_interaction' });
    emit('personalization_start', { step: 0, next_step: 1, trigger: trigger || 'first_interaction' });
  }

  function startExperience() {
    markExperienceStarted('start_button');
    quiz.hidden = false;
    progress.hidden = false;
    steps[0].hidden = false;
    const pendingStep = steps.find(function (step) { return !answers[step.dataset.hKey]; });
    const target = pendingStep || result;
    scrollToElement(target);
    focusHeading(target);
  }

  root.querySelectorAll('[data-h-start]').forEach(function (button) {
    button.addEventListener('click', startExperience);
  });

  root.querySelectorAll('[data-h-personalized-link]').forEach(function (button) {
    button.addEventListener('click', function (event) {
      event.preventDefault();
      scrollToElement(personalizedCopy);
      focusHeading(personalizedCopy);
    });
  });

  quiz.addEventListener('focusin', function () {
    markExperienceStarted('first_focus');
  });

  quiz.addEventListener('pointerdown', function () {
    interactionMode = 'pointer';
  });

  quiz.addEventListener('keydown', function () {
    interactionMode = 'keyboard';
  });

  steps.forEach(function (step, index) {
    step.addEventListener('change', function (event) {
      const input = event.target.closest('input[type="radio"]');
      if (!input) return;
      markExperienceStarted('first_answer');
      const key = step.dataset.hKey;
      const previous = answers[key];
      if (previous && previous !== input.value) resetAfter(index);
      answers[key] = input.value;

      const reply = step.querySelector('[data-h-reply]');
      if (reply) {
        reply.textContent = selectedReply(input, key);
        reply.hidden = false;
      }

      updateProgress();
      renderPersonalization();
      const stepPayload = {
        step: index + 1,
        next_step: index + 1 < totalSteps ? index + 2 : 'result',
        intent: key + ':' + input.value,
        trigger: 'answer'
      };
      if (input.hasAttribute('data-qualified')) stepPayload.qualified = input.dataset.qualified === 'true';
      emit('quiz_step', stepPayload);

      if (index + 1 < totalSteps) {
        const nextStep = steps[index + 1];
        revealStep(index + 1);
        liveStatus.textContent = 'Resposta registrada. Pergunta ' + (index + 2) + ' de ' + totalSteps + ' liberada.';
        if (interactionMode === 'pointer') {
          window.setTimeout(function () { scrollToElement(nextStep); }, reducedMotion.matches ? 0 : 220);
        }
      } else {
        renderResult();
        if (interactionMode === 'pointer') {
          window.setTimeout(function () { scrollToElement(result); }, reducedMotion.matches ? 0 : 220);
        }
      }
    });
  });

  root.querySelectorAll('[data-h-restart]').forEach(function (button) {
    button.addEventListener('click', function () {
      Object.keys(answers).forEach(function (key) { delete answers[key]; });
      steps.forEach(function (step, index) {
        step.hidden = index !== 0;
        step.classList.toggle('is-revealed', index === 0);
        const checked = step.querySelector('input:checked');
        if (checked) checked.checked = false;
        const reply = step.querySelector('[data-h-reply]');
        if (reply) {
          reply.hidden = true;
          reply.textContent = '';
        }
      });
      result.hidden = true;
      setAfterVisible(false);
      body.removeAttribute('data-qualification');
      updateProgress();
      const defaults = content[offer].defaults;
      updateLiveCopy(defaults.kicker, defaults.title, defaults.text, 0);
      emit('quiz_restart', { step: 0, next_step: 1, trigger: 'restart' });
      emit('personalization_start', { step: 0, next_step: 1, trigger: 'restart' });
      scrollToElement(steps[0]);
      focusHeading(steps[0]);
    });
  });

  quiz.hidden = false;
  progress.hidden = false;
  steps[0].hidden = false;
  setAfterVisible(false);

})();
